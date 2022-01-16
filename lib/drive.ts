import { HyperGraphDB, Vertex, Corestore, GraphObject, QueryState } from 'hyper-graphdb'
import { CertaCryptGraph, ShareGraphObject, SHARE_GRAPHOBJECT } from 'certacrypt-graph'
import { Cipher, ICrypto, Primitives } from 'certacrypt-crypto'
import { cryptoCorestore, wrapTrie } from './crypto'
import { Directory, DriveGraphObject } from './graphObjects'
import { CBF, CB1, CB2, Hyperdrive, readdirOpts, readdirResult, Stat, encryptionOpts, CB0, spaceMetaData, shareMetaData } from './types'
import { MetaStorage } from './meta'
import createHyperdrive from 'hyperdrive'
import coreByteStream from 'hypercore-byte-stream'
import MiniPass from 'minipass'
import unixify from 'unixify'
import { ReadStream, WriteStream } from 'fs'
import { IVertex } from 'hyper-graphdb/lib/Vertex'
import { debug } from './debug'
import { createUrl, parseUrl, URL_TYPES } from '..'
import { CollaborationSpace, SpaceQueryState } from './space'
import { DriveShares } from './driveshares'
import MountableHypertrie from 'mountable-hypertrie'

export type CryptoHyperdrive = Hyperdrive & {
  updateRoot(vertex?: Vertex<Directory>): Promise<Vertex<Directory>>
  getSpace(path: string): Promise<{ space: CollaborationSpace; metadata: spaceMetaData }>
  setShares(shares: DriveShares)
}

export async function cryptoDrive(corestore: Corestore, graph: CertaCryptGraph, crypto: ICrypto, root: Vertex<Directory>): Promise<CryptoHyperdrive> {
  let metadataFeed = root.getContent()?.trie
  let metadataRootFile = root.getContent()?.filename
  if (!metadataFeed && metadataRootFile) {
    const { feed } = parseUrl(metadataRootFile)
    metadataFeed = feed
  }

  const seed = Primitives.hash(Buffer.concat([Buffer.from('cryptoDrive'), Buffer.from(root.getFeed(), 'hex'), Buffer.from([root.getId()])]))
  corestore = cryptoCorestore(corestore.namespace(seed.toString('hex')), crypto)
  const drive = <Hyperdrive & CryptoHyperdrive>(<unknown>createHyperdrive(corestore, metadataFeed)) // dirty fix
  await drive.promises.ready()

  if (!metadataFeed && root.getWriteable()) {
    metadataFeed = drive.db.key.toString('hex')
    const dir = root.getContent() || new Directory()
    dir.trie = metadataFeed
    root.setContent(dir)
    await graph.put(root)
  }

  const meta = new MetaStorage(drive, graph, root, crypto)
  drive.db = wrapTrie(drive.db, crypto)

  const oldCreateWriteStream = drive.createWriteStream
  const oldLstat = drive.lstat
  const oldReaddir = drive.readdir
  const oldMkdir = drive.mkdir
  const oldUnlink = drive.unlink

  drive.createReadStream = createReadStream
  drive.createWriteStream = createWriteStream
  drive.lstat = lstat
  drive.readdir = readdir
  drive.mkdir = mkdir
  drive.unlink = unlink
  drive.promises.unlink = unlink
  drive.updateRoot = (dir?: Vertex<Directory>) => meta.updateRoot(dir)
  drive.getSpace = getSpace
  drive.setShares = (shares: DriveShares) => meta.setDriveShares(shares)

  return drive

  function createReadStream(name, opts) {
    name = unixify(name)
    opts = fixOpts(opts)

    // in order not to break the existing api, files are public by default!
    const encrypted = !!opts.db.encrypted

    const filePromise = meta.readableFile(name, encrypted)
    const out = new MiniPass()

    filePromise.then(prepareStream).catch((err) => out.destroy(err))
    return out

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
        byteOffset: opts.start ? stat.byteOffset + opts.start : length === -1 ? -1 : stat.byteOffset,
        byteLength: Math.min(length, stat.size)
      })

      return stream
    }
  }

  function createWriteStream(name, opts): WriteStream {
    name = unixify(name)
    opts = fixOpts(opts)

    // in order not to break the existing api, files are public by default!
    const encrypted = !!opts.db.encrypted
    const dbOpts = encrypted ? { encrypted: true, hidden: true } : undefined
    opts.db = dbOpts

    const input = new MiniPass()
    const state = meta
      .writeableFile(name, encrypted)
      .then(prepareStream)
      .catch((err) => {
        input.destroy(err)
        return Promise.reject(err)
      })

    drive.once('appending', async (filename) => {
      const { path, fkey, stream } = await state
      if (filename !== path) throw new Error('appending name !== filename')

      const passedOpts = { trie: true, db: dbOpts }
      drive.stat(path, passedOpts, async (err, stat, trie) => {
        if (err && err.errno !== 2) return input.destroy(err)
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

    input.on('error', (err) => {
      // TODO: delete graph vertex on error
      console.error(err)
    })

    return input

    function prepareStream(state: { path: string; fkey?: Buffer; mkey?: Buffer; trie: MountableHypertrie; vertex: Vertex<DriveGraphObject> }) {
      const stream = oldCreateWriteStream.call(drive, state.path, opts)
      stream.on('error', (err) => input.destroy(err))
      stream.on('end', onClose)
      input.on('error', (err) => stream.destroy(err))
      return {
        ...state,
        stream
      }
    }

    async function onClose() {
      const { path, fkey, mkey, vertex, trie } = await state
      const version = trie.version + 1
      const file = vertex.getContent()
      const feed = trie.getFeed().key.toString('hex')
      file.filename = `hyper://${feed}+${version}${path}`
      if (encrypted) file.filename += `?mkey=${mkey.toString('hex')}&fkey=${fkey.toString('hex')}`
      vertex.setContent(file)
      await graph.put(vertex)
    }
  }

  function lstat(name: string, opts: extendedOpts, cb: CB2<Stat, any>): Promise<Stat> | any {
    name = unixify(name)
    opts = fixOpts(opts)
    if (!opts.resolve) {
      return oldLstat.call(drive, name, opts, cb)
    } else {
      return meta
        .find(name, false)
        .then(async ({ path, feed, vertex, version }) => {
          const feedTrie = await meta.getTrie(feed, version)
          const { stat, trie } = await meta.lstat(vertex, path, !!opts.db.encrypted, feedTrie, !!opts.file)
          cb(null, stat, trie)
          return stat
        })
        .catch((err) => cb(err))
    }
  }

  async function readdir(name: string, opts: readdirOpts | any, cb: CB1<readdirResult[]>) {
    name = unixify(name)
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted
    if (!encrypted) return oldReaddir.call(drive, name, opts, cb)

    const resultMap = new Map<String, { label: string; path: string; stat: Stat; timestamp: number; space?: spaceMetaData; share?: shareMetaData }>()

    const files = await graph
      .queryPathAtVertex(name, await meta.updateRoot())
      .out()
      .generator()
      .rawQueryStates(onError)
    for (const state of files) {
      const vertex = <Vertex<DriveGraphObject>>state.value
      const timestamp = typeof vertex.getTimestamp === 'function' ? vertex.getTimestamp() : 0

      const label = state.path[state.path.length - 1].label
      let path: string
      if (name.endsWith('/')) path = name + label
      else path = name + '/' + label

      let file
      try {
        file = await meta.readableFile(path)
      } catch (err) {
        console.error(err)
      }
      if (!file || !file.stat) continue // might be a thombstone, or an error occured

      const child = { label, path, stat: file.stat, space: file.spaceMeta, share: file.share, timestamp }
      if (resultMap.has(child.path)) {
        const other = resultMap.get(child.path)
        if (other.timestamp < child.timestamp) resultMap.set(child.path, child)
      } else {
        resultMap.set(child.path, child)
      }
    }

    const results = new Array<readdirResult>()
    for (const child of resultMap.values()) {
      if (opts.includeStats) {
        results.push({ name: child.label, path: child.path, stat: child.stat, space: child.space, share: child.share })
      } else {
        results.push(child.label)
      }
    }

    return cb(null, results)

    function onError(err: Error) {
      console.error(`Error on readdir ${name}:\n${err.name}: ${err.message}`)
      debug(`Error stacktrace \n${err.stack ? err.stack : '(no stacktrace available)'}`)
    }
  }

  function mkdir(name: string, opts?: extendedOpts | CBF, cb?: CBF) {
    name = unixify(name)
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted
    if (!encrypted) return oldMkdir.call(drive, name, opts, cb)

    meta
      .createDirectory(name, (fileid, mkdirCb) => oldMkdir.call(drive, fileid, { db: { encrypted: true } }, mkdirCb))
      .then((v) => cb(null, v))
      .catch((err) => cb(err))
  }

  async function unlink(name: string, opts?: extendedOpts | CB0, cb?: CB0) {
    if (typeof opts === 'function') return unlink(name, undefined, opts)

    name = unixify(name)
    opts = fixOpts(opts)
    const encrypted = opts.db.encrypted
    if (!encrypted) return oldUnlink.call(drive, name, cb)

    await meta.unlink(name)
    if (cb) cb()
  }

  async function getSpace(path: string) {
    const file = await meta.readableFile(path, true)
    return { space: file.space, metadata: file.spaceMeta }
  }
}

type extendedOpts = { db?: { encrypted?: boolean }; encrypted?: boolean } & any
type fixedOpts = { db: { encrypted?: boolean } } & any

function fixOpts(opts: extendedOpts): fixedOpts {
  opts = Object.assign({}, opts)
  opts.db = opts.db || {}
  opts.db.encrypted = !!(opts.db.encrypted || opts.encrypted)
  return opts
}

function distinct<T>(arr: T[]): T[] {
  return [...new Set(arr).values()]
}
