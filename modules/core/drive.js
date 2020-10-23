const Minipass = require('minipass')
const unixify = require('unixify')
const URL = require('url').URL
const { Stat } = require('hyperdrive-schemas')
const coreByteStream = require('hypercore-byte-stream')

const wrapHypertrie = require('../hypertrie-encryption-wrapper')
const Graph = require('../graph')
const { FileNotFound, PathAlreadyExists } = require('hyperdrive/lib/errors')
const primitives = require('../crypto/lib/primitives')

module.exports = async function wrapHyperdrive (drive, context, mainKey = null, create = true) {
  await drive.promises.ready()

  const graph = new Graph(drive.db, context)
  const drivekey = drive.key.toString('hex')
  drive.db.trie = wrapHypertrie(
    drive.db.trie,
    context.getStatEncryptor(drivekey),
    context.getStatDecryptor(drivekey),
    null,
    context.getNodeDecryptor(drivekey)
  )

  if (create) {
    await graph.createRootNode(mainKey, !!create)
  } else {
    // await new Promise((resolve, reject) => drive.db.feed.head((err) => err ? reject(err) : resolve()))
    await graph.registerRootNode(mainKey)
  }

  const oldCreateWriteStream = drive.createWriteStream
  const oldCreateReadStream = drive.createReadStream
  const oldMkdir = drive.mkdir
  const oldLstat = drive.lstat
  const oldReaddir = drive.readdir

  drive.mkdir = mkdir
  drive.createReadStream = createReadStream
  drive.createWriteStream = createWriteStream
  drive.lstat = lstat
  drive.readdir = readdir
  drive.writeEncryptedFile = (name, buf, opts, cb) => drive.writeFile(name, buf, Object.assign({}, opts, { db: { encrypted: true } }, cb))
  drive.readEncryptedFile = (name, opts, cb) => drive.readFile(name, Object.assign({}, opts, { db: { encrypted: true } }, cb))
  drive.promises.shareByURL = shareByURL
  drive.promises.mountURL = mountURL
  drive.shareByURL = async (path, opts, cb) => shareByURL(path, opts).then(url => cb(null, url)).catch(err => cb(err))
  drive.mountURL = async (url, path, cb) => mountURL(url, path, cb).then(cb).catch(err => cb(err))
  return drive

  async function mkdir (name, opts, cb) {
    name = unixify(name)
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted

    if (!encrypted) {
      return oldMkdir.call(name, opts, cb)
    }

    let { node, parent } = await graph.find(name)
    if (!parent) throw new Error('no parent found')
    if (node) throw new PathAlreadyExists(name)

    const filename = name.substr(name.lastIndexOf('/') + 1)
    node = await graph.createDir(true, true)
    await graph.linkNode(node, parent, filename, null, true)
    return oldMkdir.call(drive, node.dir.file.id, opts, cb)
  }

  function createReadStream (name, opts) {
    name = unixify(name)
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted

    let namePromise
    if (encrypted) {
      namePromise = prepareNodes()
    } else {
      namePromise = preparePublic()
    }
    const out = new Minipass()

    namePromise.then(prepareStream).catch(err => out.destroy(err))
    return out

    async function prepareNodes () {
      const { node, trie } = await graph.find(name)
      if (!node) throw new FileNotFound(name)
      if (!node.file) throw new Error('node is not of type file')
      return { filename: '/' + node.file.id, trie }
    }

    async function prepareStream ({ filename, trie }) {
      let stream
      const length = typeof opts.end === 'number' ? 1 + opts.end - (opts.start || 0) : typeof opts.length === 'number' ? opts.length : -1
      if (trie === drive.db) {
        stream = oldCreateReadStream.call(drive, filename, opts)
      } else {
        stream = coreByteStream({
          ...opts,
          highWaterMark: opts.highWaterMark || 64 * 1024
        })
        const passedOpts = { file: true }
        if (opts.db) passedOpts.db = opts.db
        drive.stat(name, passedOpts, onstat)
      }
      stream.on('error', (err) => out.destroy(err))
      // out.on('error', (err) => stream.destroy(err))
      stream.pipe(out)
      return stream

      function onstat (err, stat, trie) {
        if (err) return stream.destroy(err)
        return drive._getContent(trie.feed, (err, contentState) => {
          if (err) return stream.destroy(err)
          return oncontent(stat, contentState)
        })
      }

      function oncontent (st, contentState) {
        stream.start({
          feed: contentState.feed,
          blockOffset: st.offset,
          blockLength: st.blocks,
          byteOffset: opts.start ? st.byteOffset + opts.start : (length === -1 ? -1 : st.byteOffset),
          byteLength: Math.min(length, st.size)
        })
      }
    }

    async function preparePublic () {
      // insert a zero-key into the keystore so the cryptocontext knows the file is unencrypted
      await new Promise((resolve, reject) => {
        drive.stat(name, { trie: true }, async (err, stat, trie) => {
          if (err) return reject(err)
          drive._getContent(trie.feed, async (err, contentState) => {
            if (err) return reject(err)
            if (!stat) return reject(new FileNotFound(name))
            const feedKey = contentState.feed.key
            const offset = stat.offset
            context.preparePublicStream(feedKey.toString('hex'), offset)
            resolve()
          })
        })
      })

      return name
    }
  }

  function createWriteStream (name, opts) {
    name = unixify(name)
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted

    let namePromise
    if (encrypted) {
      namePromise = prepareNodes()
    } else {
      namePromise = new Promise(resolve => resolve({ name }))
    }

    // writing to the stream needs to be deferred until the context is prepared
    const input = new Minipass()
    const streamPromise = namePromise.then(prepareStream)

    drive.once('appending', async (filename) => {
      const { name, node, onSuccess } = await namePromise
      if (filename !== name) throw new Error('appending name !== filename')
      const passedOpts = { trie: true }
      if (encrypted) passedOpts.db = { encrypted: true }
      drive.stat(name, passedOpts, async (err, stat, trie) => {
        if (err && (err.errno !== 2)) return input.destroy(err)
        drive._getContent(trie.feed, async (err, contentState) => {
          if (err) return input.destroy(err)

          const feedKey = contentState.feed.key
          if (encrypted) {
            node.file.streamOffset = contentState.feed.length
            node.file.streamId = feedKey
            context.prepareStream(feedKey.toString('hex'), contentState.feed.length)
            await graph.saveNode(node)
            await onSuccess()
          } else {
            context.preparePublicStream(feedKey.toString('hex'), contentState.feed.length)
          }
          input.pipe(await streamPromise)
        })
      })
    })

    return input

    async function prepareNodes () {
      const filename = name.substr(name.lastIndexOf('/') + 1)
      let { node, parent } = await graph.find(name)
      if (!parent) throw new Error('no parent node found')
      if (!node) {
        // don't save yet, we still need the content feed id and offset
        const driveKey = drive.db.feed.key.toString('hex')
        node = await graph.createFile(false)
        context.prepareNode(driveKey, node.id)
        context.prepareStat(driveKey, node.file.id)
      }

      return { name: '/' + node.file.id, node: node, onSuccess: onFileCreated }

      // only create link if the file creation is successful
      async function onFileCreated () {
        await graph.linkNode(node, parent, filename, null, true)
      }
    }

    function prepareStream ({ name }) {
      const stream = oldCreateWriteStream.call(drive, name, Object.assign(opts, { db: { encrypted: encrypted } }))
      stream.on('error', (err) => input.destroy(err))
      input.on('error', (err) => stream.destroy(err))
      return stream
    }
  }

  async function lstat (name, opts, cb) {
    name = unixify(name)
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted
    const self = this

    if (!encrypted || name.startsWith('/' + graph.prefix)) {
      return oldLstat.call(drive, name, opts, cb)
    }

    const { node, trie } = await graph.find(name)
    if (!node) return cb(new FileNotFound(name))
    if (node.share) return cb(null, Stat.directory(), trie)
    const file = (node.file || (node.dir ? node.dir.file : null))
    if (!file) return cb(new Error('graph node is not a file or directory'))

    if (trie === this.db) {
      return oldLstat.call(drive, file.id, opts, cb)
    } else {
      // mounted drive
      trie.get(file.id, opts.db, onRemoteStat)
    }

    function onRemoteStat (err, node, trie, mount, mountPath) {
      if (err) return cb(err)
      if (!node && opts.trie) return cb(null, null, trie, mount, mountPath)
      if (!node && opts.file) return cb(new FileNotFound(name))
      if (!node) return cb(null, Stat.directory(), trie) // TODO: modes?
      try {
        var st = Stat.decode(node.value)
      } catch (err) {
        return cb(err)
      }
      const writingFd = self._writingFds.get(name)
      if (writingFd) {
        st.size = writingFd.stat.size
      }
      cb(null, st, trie, mount, mountPath)
    }
  }

  async function readdir (name, opts, cb) {
    name = unixify(name)
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted
    if (!encrypted) return oldReaddir.call(drive, name, opts, cb)

    const { node } = await graph.find(name)
    if (!node) return cb(new FileNotFound(name))
    if (!node.dir) return cb(new Error('graph node is not a directory'))
    if (!Array.isArray(node.dir.children)) return cb(null, [])

    const entries = []
    for (const child of node.dir.children) {
      const childname = name + '/' + child.name
      if (opts.recursive) {
        const node = await graph.getNode(child.id)
        if (node.dir) {
          const sub = await drive.promises.readdir(childname, opts)
          sub.forEach(f => entries.push(f))
        }
      }

      if (opts.includeStats) {
        entries.push({
          name: child.name,
          path: childname,
          stat: await drive.promises.stat(childname, opts)
        })
      } else {
        entries.push(child.name)
      }
    }
    return cb(null, entries)
  }

  async function shareByURL (path, opts = { encrypted: true }) {
    path = unixify(path)
    path = path.startsWith('/') ? path : '/' + path
    opts = fixOpts(opts)
    if (!opts.name) opts.name = 'url to' + path

    if (!await drive.promises.exists(path, opts)) throw new FileNotFound(path)

    const url = 'hyper://' + drive.key.toString('hex')
    if (!opts.encrypted) return url + path

    const { node } = await graph.find(path)
    const share = await graph.createShare(opts.name, false)
    const secret = primitives.generateEncryptionKey()
    const secretString = secret.toString('hex')
    context.prepareNode(drive.key.toString('hex'), share.id, secret)

    const filename = path.substring(path.lastIndexOf('/') + 1)
    await graph.linkNode(node, share, filename, null, true)
    return url + '/' + share.id + '?key=' + secretString
  }

  async function mountURL (url, path) {
    const parsed = new URL(url)
    const key = Buffer.from(parsed.host, 'hex')
    const id = unixify(parsed.pathname).substring(1)
    const secret = parsed.searchParams.get('key')
    if (!key || !id || !secret) throw new Error('invalid url')

    const { node, parent } = await graph.find(path)
    if (!parent) throw new FileNotFound(path.substring(0, path.lastIndexOf('/')))
    if (node) throw new PathAlreadyExists(path)

    const remoteGraph = await graph.getRemoteGraph(graph.db.corestore, key)
    context.prepareNode(key.toString('hex'), id, Buffer.from(secret, 'hex'))
    const share = await remoteGraph.getNode(id)
    if (!share) throw new Error('could not load url')

    await graph.linkNode(share, parent, path, key, true)
  }
}

function fixOpts (opts) {
  opts = Object.assign({}, opts)
  opts.db = opts.db || {}
  opts.db.encrypted = opts.db.encrypted || opts.encrypted
  return opts
}
