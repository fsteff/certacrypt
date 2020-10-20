const wrapHypertrie = require('../hypertrie-encryption-wrapper')
const Minipass = require('minipass')
const unixify = require('unixify')
const Graph = require('../graph')

module.exports = async function wrapHyperdrive (drive, context) {
  await drive.promises.ready()

  const graph = new Graph(drive.db, context)
  // TODO: persist & load
  await graph.createRootNode(true)

  const drivekey = drive.key.toString('hex')
  const oldCreateWriteStream = drive.createWriteStream
  // const oldMkdir = drive.mkdir // TODO: mkdir

  drive.db.trie = wrapHypertrie(
    drive.db.trie,
    context.getStatEncryptor(drivekey),
    context.getStatDecryptor(drivekey)
  )

  drive.createWriteStream = createWriteStream

  function createWriteStream (name, opts, encrypted) {
    name = unixify(name)
    opts = Object.assign({}, opts)
    opts.db = opts.db || (encrypted ? { encrypted: true } : {})
    if (!encrypted && opts.db.encrypted) encrypted = true

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
      const filename = name.substr(name.lastIndexOf('/'))
      let { node, parent } = await graph.find(name)
      // TODO: why is parent null?
      if (!parent) throw new Error('no parent node found')
      if (!node) {
        node = graph.createFile()
        context.prepareNode(drivekey, node.id)
        context.prepareStat(drivekey, node.file.id)
        graph.saveNode(node)
      }
      graph.linkNode(node, parent, filename)
      graph.saveNode(parent, false)

      return '/' + node.file.id
    }

    function prepareStream (filename) {
      const stream = oldCreateWriteStream.call(drive, filename, Object.assign(opts, { db: { encrypted: encrypted } }))
      stream.on('error', (err) => input.destroy(err))
      input.on('error', (err) => stream.destroy(err))
      return stream
    }
  }

  return drive
}
