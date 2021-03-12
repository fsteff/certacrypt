import { HyperGraphDB, Vertex, Corestore, GraphObject } from 'hyper-graphdb'
import { CertaCryptGraph } from 'certacrypt-graph'
import { Cipher, ICrypto } from 'certacrypt-crypto'
import { cryptoCorestore } from './crypto'
import { Directory, GraphObjectTypeNames } from './graphObjects'
import { CB1, CB2, Hyperdrive, readdirOpts, readdirResult, Stat } from './types'
import { MetaStorage } from './meta'
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
  const oldReaddir = drive.readdir

  drive.createReadStream = createReadStream
  drive.createWriteStream = createWriteStream
  drive.lstat = lstat
  drive.readdir = readdir

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
    const dbOpts = encrypted ? { encrypted: true, hidden: true } : undefined
    opts.db = dbOpts

    const input = new MiniPass()
    const state = meta.writeableFile(name, encrypted)
      .then(prepareStream)
      .catch(err => input.destroy(err))

    drive.once('appending', async (filename) => {
      const { path, fkey, stream } = await state
      if (filename !== path) throw new Error('appending name !== filename')

      const passedOpts = { trie: true, db: dbOpts }
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

  function lstat(name: string, opts: extendedOpts, cb: CB2<Stat, any>): Promise<Stat> | any {
    opts = fixOpts(opts)
    if (!opts.resolve) {
      return oldLstat.call(drive, name, opts, cb)
    } else {
      return meta.find(name)
        .then(async ({ path, feed }) => {
          const feedTrie = await meta.getTrie(feed)
          const { stat, trie } = await meta.lstat(path, !!opts.db.encrypted, feedTrie, !!opts.file)
          cb(null, stat, trie)
          return stat
        })
        .catch(err => cb(err))
    }
  }

  async function readdir(name: string, opts: readdirOpts, cb: CB1<readdirResult[]>) {
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted
    if (!encrypted) return oldReaddir.call(drive, name, opts, cb)

    const results = new Array<readdirResult>()
    for await (const vertex of graph.queryPathAtVertex(name, root).vertices()) {
      const labels = distinct(vertex.getEdges().map(edge => edge.label))
      const children = labels
          .map(label => {
            return { path: name + '/' + label, label }
          })
          .map(async ({ path, label }) => {
            try {
              const file = await meta.readableFile(path)
              return { label, ... file }
            } catch(err) {
              console.error(err)
              return null
            }
          })
          .filter(child => !!child)

        for (const child of await Promise.all(children)) {
          if(opts.includeStats) {
          results.push({ name: child.label, path: child.path, stat: child.stat })
          } else {
            results.push(child.label)
          }
        }
    }

    return cb(null, results)
  }
}

type extendedOpts = { db?: { encrypted?: boolean }, encrypted?: boolean } & any
type fixedOpts = { db: { encrypted?: boolean } } & any

function fixOpts(opts: extendedOpts): fixedOpts {
  opts = Object.assign({}, opts)
  opts.db = opts.db || {}
  opts.db.encrypted = !!(opts.db.encrypted || opts.encrypted)
  return opts
}

function isDriveObject(vertex: Vertex<GraphObject>) {
  const type = vertex.getContent()?.typeName
  return type === GraphObjectTypeNames.DIRECTORY || type === GraphObjectTypeNames.FILE
}

function distinct<T>(arr: T[]): T[] {
  return [... (new Set(arr).values())]
}