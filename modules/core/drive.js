const wrapHypertrie = require('../hypertrie-encryption-wrapper')
const Minipass = require('minipass')
const unixify = require('unixify')
const Graph = require('../graph')
const { FileNotFound, PathAlreadyExists } = require('hyperdrive/lib/errors')

module.exports = async function wrapHyperdrive (drive, context) {
  await drive.promises.ready()

  const graph = new Graph(drive.db, context)
  // TODO: persist & load
  await graph.createRootNode(true)

  const drivekey = drive.key.toString('hex')
  const oldCreateWriteStream = drive.createWriteStream
  const oldCreateReadStream = drive.createReadStream
  const oldMkdir = drive.mkdir
  const oldLstat = drive.lstat
  const oldReaddir = drive.readdir

  drive.db.trie = wrapHypertrie(
    drive.db.trie,
    context.getStatEncryptor(drivekey),
    context.getStatDecryptor(drivekey),
    null,
    context.getNodeDecryptor(drivekey)
  )

  drive.mkdir = mkdir
  drive.createReadStream = createReadStream
  drive.createWriteStream = createWriteStream
  drive.lstat = lstat
  drive.readdir = readdir
  drive.writeEncryptedFile = (name, buf, opts, cb) => drive.writeFile(name, buf, Object.assign({}, opts, { db: { encrypted: true } }, cb))
  drive.readEncryptedFile = (name, opts, cb) => drive.readFile(name, Object.assign({}, opts, { db: { encrypted: true } }, cb))
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
      namePromise = new Promise(resolve => resolve(name))
    }
    const out = new Minipass()

    namePromise.then(prepareStream)
    return out

    async function prepareNodes () {
      const { node } = await graph.find(name)
      if (!node) throw new FileNotFound(name)
      if (!node.file) throw new Error('node is not of type file')
      return '/' + node.file.id
    }

    async function prepareStream (filename) {
      const stream = oldCreateReadStream.call(drive, filename, opts)
      stream.on('error', (err) => out.destroy(err))
      // out.on('error', (err) => stream.destroy(err))
      stream.pipe(out)
      return stream
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
      namePromise = new Promise(resolve => resolve(name))
    }

    // writing to the stream needs to be deferred until the context is prepared
    const input = new Minipass()
    const streamPromise = namePromise.then(prepareStream)

    drive.once('appending', async (filename) => {
      const driveName = await namePromise
      if (filename !== driveName) throw new Error('appending name !== filename')
      const passedOpts = { trie: true }
      if (encrypted) passedOpts.db = { encrypted: true }
      drive.stat(driveName, passedOpts, async (err, stat, trie) => {
        if (err && (err.errno !== 2)) return input.destroy(err)
        drive._getContent(trie.feed, async (err, contentState) => {
          if (err) return input.destroy(err)

          const feedkey = contentState.feed.key.toString('hex')
          if (encrypted) context.prepareStream(feedkey, contentState.feed.length)
          else context.preparePublicStream(feedkey, contentState.feed.length)

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
        node = await graph.createFile(true, true)
      }
      await graph.linkNode(node, parent, filename, null, true)

      return '/' + node.file.id
    }

    function prepareStream (filename) {
      const stream = oldCreateWriteStream.call(drive, filename, Object.assign(opts, { db: { encrypted: encrypted } }))
      stream.on('error', (err) => input.destroy(err))
      input.on('error', (err) => stream.destroy(err))
      return stream
    }
  }

  async function lstat (name, opts, cb) {
    name = unixify(name)
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted

    if (!encrypted || name.startsWith('/' + graph.prefix)) {
      return oldLstat.call(drive, name, opts, cb)
    }

    const { node } = await graph.find(name)
    if (!node) return cb(new FileNotFound(name))
    const file = (node.file || (node.dir ? node.dir.file : null))
    if (!file) return cb(new Error('graph node is not a file or directory'))
    return oldLstat.call(drive, file.id, opts, cb)
  }

  async function readdir (name, opts, cb) {
    name = unixify(name)
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted
    if (!encrypted) return oldReaddir.call(drive, name, opts, cb)

    const { node } = await graph.find(name)
    if (!node) return cb(new FileNotFound(name))
    if (!node.dir) return cb(new Error('graph node is not a directory'))

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
}

function fixOpts (opts) {
  opts = Object.assign({}, opts)
  opts.db = opts.db || {}
  opts.db.encrypted = opts.db.encrypted || opts.encrypted
  return opts
}