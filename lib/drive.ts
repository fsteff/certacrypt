import { HyperGraphDB, Vertex, Corestore } from 'hyper-graphdb'
import { CertaCryptGraph } from 'certacrypt-graph'
import { Cipher, ICrypto } from 'certacrypt-crypto'
import { cryptoCorestore } from './crypto'
import { Directory, File, DriveGraphObject } from './graphObjects'
import { CB0, CB1, CB2, Hyperdrive, Stat } from './types'
import { MetaStorage } from './meta'
import { Feed } from 'hyperobjects'
import createHyperdrive from 'hyperdrive'
import coreByteStream from 'hypercore-byte-stream'
import MiniPass from 'minipass'
import unixify from 'unixify'

export async function cryptoDrive(corestore: Corestore, graph: CertaCryptGraph, crypto: ICrypto, root: Vertex<Directory>): Promise<Hyperdrive> {
  corestore = cryptoCorestore(corestore.namespace('cryptoDrive'), crypto)
  const drive = <Hyperdrive><unknown>createHyperdrive(corestore) // dirty fix 
  await drive.promises.ready()

  const meta = new MetaStorage(drive, graph, root, crypto)

  const oldCreateWriteStream = drive.createWriteStream
  const oldLstat = drive.lstat

  drive.createReadStream = createReadStream
  drive.createWriteStream = createWriteStream
  //drive.lstat = lstat

  return drive

  function createReadStream(name, opts) {
    name = unixify(name)
    opts = fixOpts(opts)

    // in order not to break the existing api, files are public by default!
    const encrypted = !!opts.db.encrypted

    const filePromise = meta.readableFile(name, encrypted)
    const out = new MiniPass()

    filePromise.then(prepareStream).catch(err => out.destroy(err))
    return <ReadableStream<any>><unknown>out // only mimics a readable stream, so we have to cast it


    async function prepareStream({ stat, contentFeed }) {
      let stream
      const length = typeof opts.end === 'number' ? 1 + opts.end - (opts.start || 0) : typeof opts.length === 'number' ? opts.length : -1
      stream = coreByteStream({
        ...opts,
        highWaterMark: opts.highWaterMark || 64 * 1024
      })

      stream.on('error', (err) => out.destroy(err))
      stream.pipe(out)
      stream.start({
        feed: contentFeed,
        blockOffset: stat.offset,
        blockLength: stat.blocks,
        byteOffset: opts.start ? stat.byteOffset + opts.start : (length === -1 ? -1 : stat.byteOffset),
        byteLength: Math.min(length, stat.size)
      })

      return stream
    }
  }

  function createWriteStream(name, opts): WritableStream<any> {
    name = unixify(name)
    opts = fixOpts(opts)
    // in order not to break the existing api, files are public by default!
    const encrypted = !!opts.db.encrypted
    const input = new MiniPass()
    const state = meta.writeableFile(name, encrypted)
      .then(prepareStream)
      .catch(err => input.destroy(err))

    drive.once('appending', async (filename) => {
      const { path, fkey, stream } = await state
      if (filename !== path) throw new Error('appending name !== filename')
      const passedOpts = { trie: true, db: encrypted ? { encrypted: true } : undefined }
      drive.stat(path, passedOpts, async (err, stat, trie) => {
        if (err && (err.errno !== 2)) return input.destroy(err)
        drive._getContent(trie.feed, async (err, contentState) => {
          if (err) return input.destroy(err)

          const contentFeedId = contentState.feed.key.toString('hex')
          if (encrypted) {
            crypto.registerKey(fkey, { feed: contentFeedId, type: Cipher.ChaCha20_Stream, index: contentState.feed.length })
          } else {
            crypto.registerPublic(contentFeedId, contentState.feed.length)
          }
          input.pipe(stream)
        })
      })
    })

    // TODO: delete graph vertex on error

    return <WritableStream<any>><unknown>input


    function prepareStream(state: { path: string, fkey?: Buffer }) {
      const stream = oldCreateWriteStream.call(drive, state.path, opts)
      stream.on('error', (err) => input.destroy(err))
      input.on('error', (err) => stream.destroy(err))
      return {
        ...state,
        stream: <WritableStream<any>>stream
      }
    }
  }

  function lstat(name: string, opts: extendedOpts, cb: CB2<Stat, any>) {
    opts = fixOpts(opts)
    if (opts.db.public || !opts.db.resolve) {
      return oldLstat.call(drive, name, opts, cb)
    } else {
      meta.find(name)
        .then(async ({ path, feed }) => {
          const feedTrie = await meta.getTrie(feed)
          const { stat, trie } = await meta.lstat(path, feedTrie, !!opts.file)
          cb(null, stat, trie)
        })
        .catch(err => cb(err))
    }
  }
}

type extendedOpts = { db?: { public?: boolean }, public?: boolean } & any
type fixedOpts = { db: { public?: boolean } } & any

function fixOpts(opts: extendedOpts): fixedOpts {
  opts = Object.assign({}, opts)
  opts.db = opts.db || {}
  opts.db.encrypted = !!(opts.db.encrypted || opts.encrypted)
  return opts
}
