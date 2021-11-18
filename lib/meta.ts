import { CB0, Hyperdrive, Stat } from './types'
import { CertaCryptGraph, SHARE_GRAPHOBJECT } from 'certacrypt-graph'
import { Generator, GraphObject, GRAPH_VIEW, IVertex, QueryState, Vertex } from 'hyper-graphdb'
import { Directory, DriveGraphObject, File, GraphObjectTypeNames, Thombstone } from './graphObjects'
import { FileNotFound, PathAlreadyExists } from 'hyperdrive/lib/errors'
import { cryptoTrie } from './crypto'
import { Cipher, ICrypto } from 'certacrypt-crypto'
import MountableHypertrie from 'mountable-hypertrie'
import { Feed } from 'hyperobjects'
import { Stat as TrieStat } from 'hyperdrive-schemas'
import { parseUrl } from './url'
import { debug } from './debug'
import {SpaceQueryState} from './space'

export class MetaStorage {
  private readonly drive: Hyperdrive
  private readonly graph: CertaCryptGraph
  private root: Vertex<DriveGraphObject>
  private readonly tries: Map<string, MountableHypertrie>
  private readonly crypto: ICrypto
  private currentIdCtr = 0

  constructor(drive: Hyperdrive, graph: CertaCryptGraph, root: Vertex<DriveGraphObject>, crypto: ICrypto) {
    this.drive = drive
    this.graph = graph
    this.root = root
    this.crypto = crypto
    this.tries = new Map<string, MountableHypertrie>()
  }

  private async uniqueFileId() {
    console.log(await new Promise((resolve, reject) => this.drive.db.list('', (err, res) => (err ? reject(err) : resolve(res)))))
    const nodes = <{ seq: number; key: string; value: Buffer }[]>(
      await new Promise((resolve, reject) => this.drive.db.list('.enc', { hidden: true }, (err, res) => (err ? reject(err) : resolve(res))))
    )
    let idCtr = this.currentIdCtr + 1
    nodes.map((node) => parseInt(node.key.split('/', 2)[1])).forEach((id) => (idCtr = Math.max(idCtr, id + 1)))
    this.currentIdCtr = idCtr
    return '/.enc/' + idCtr
  }

  async readableFile(filename: string, encrypted = true) {
    const file = await this.find(filename)
    if (!file) throw new FileNotFound(filename)

    const { vertex, feed, path, mkey, fkey } = file
    if (vertex.getContent()?.typeName === GraphObjectTypeNames.THOMBSTONE) {
      return { path: null, trie: null, stat: null, contentFeed: null }
    }

    if (encrypted) this.crypto.registerKey(mkey, { feed, index: path, type: Cipher.XChaCha20_Blob })
    else this.crypto.registerPublic(feed, path)

    const trie = await this.getTrie(feed)
    const { stat, contentFeed } = await this.lstat(vertex, path, encrypted, trie, true)

    const dataFeed = contentFeed.key.toString('hex')
    if (encrypted) this.crypto.registerKey(fkey, { feed: dataFeed, type: Cipher.ChaCha20_Stream, index: stat.offset })
    else this.crypto.registerPublic(dataFeed, stat.offset)

    const typeName = (<Vertex<DriveGraphObject>>vertex).getContent().typeName
    if (typeName === GraphObjectTypeNames.FILE) stat.isFile = true
    else if (typeName === GraphObjectTypeNames.DIRECTORY) stat.isDirectory = true

    debug(`created readableFile ${filename} from ${encrypted ? 'encrypted' : 'public'} ${stat.isFile ? 'file' : 'directory'} hyper://${feed}${path}`)

    return { path, trie, stat, contentFeed }
  }

  async writeableFile(filename: string, encrypted = true): Promise<{ path: string; fkey?: Buffer }> {
    let parsedFile = await this.find(filename)
    let fileid: string
    let vertex: Vertex<DriveGraphObject> = parsedFile?.vertex
    const feed = this.drive.key.toString('hex')
    if (parsedFile) {
      if (encrypted) this.crypto.registerKey(parsedFile.mkey, { feed, index: parsedFile.path, type: Cipher.XChaCha20_Blob })
      else this.crypto.registerPublic(feed, parsedFile.path)

      fileid = parsedFile.path
    } else {
      vertex = this.graph.create<File>()

      if (encrypted) fileid = await this.uniqueFileId()
      else fileid = filename
    }

    let url = 'hyper://' + feed + fileid
    let fkey: Buffer
    if (encrypted) {
      const mkey = this.crypto.generateEncryptionKey(Cipher.XChaCha20_Blob)
      fkey = this.crypto.generateEncryptionKey(Cipher.ChaCha20_Stream)
      this.crypto.registerKey(mkey, { feed, type: Cipher.XChaCha20_Blob, index: fileid })
      // fkey has to be passed out to make sure the feed length isn't changed (wait until lock is set up)
      url += `?mkey=${mkey.toString('hex')}&fkey=${fkey.toString('hex')}`
    } else {
      this.crypto.registerPublic(feed, fileid)
    }
    const file = new File()
    file.filename = url
    vertex.setContent(file)
    await this.graph.put(vertex)

    debug(`created writeableFile ${filename} as ${encrypted ? 'encrypted' : 'public'} file hyper://${feed}${fileid}`)

    const created = await this.graph.createEdgesToPath(filename, this.root, vertex)
    // reload root to be sure
    this.root = <Vertex<DriveGraphObject>> await this.graph.get(this.root.getId(), this.root.getFeed())

    for (const { path } of created) {
      const dirs = await this.graph
        .queryPathAtVertex(path, this.root)
        .matches((v) => v.getContent()?.typeName === GraphObjectTypeNames.DIRECTORY)
        .generator()
        .destruct()
      if (dirs.length === 0) {
        await this.drive.promises.mkdir(path, { db: { encrypted: true } })
      }
    }

    return { path: fileid, fkey }
  }

  public async createDirectory(name: string, makeStat: (name: string, cb: CB0) => void): Promise<Vertex<Directory>> {
    let target: Vertex<Directory>

    const {state, path} = await this.findWriteablePath(name)
    const vertex = <Vertex<Directory>> (path.length === 0 ? state.value : undefined)
    const content = vertex?.getContent()
    if (content && content.filename) {
      throw new PathAlreadyExists(name)
    }

    if (vertex?.getFeed() === this.root.getFeed()) {
      target = vertex
    } else {
      target = this.graph.create<Directory>()
    }

    const feed = this.drive.db.feed.key.toString('hex')
    const mkey = this.crypto.generateEncryptionKey(Cipher.XChaCha20_Blob)
    const fileid = await this.uniqueFileId()
    const url = `hyper://${feed}${fileid}?mkey=${mkey.toString('hex')}`
    const dir = target.getContent() || new Directory()
    dir.filename = url
    target.setContent(dir)
    this.crypto.registerKey(mkey, { feed, type: Cipher.XChaCha20_Blob, index: fileid })

    await new Promise((resolve, reject) => makeStat.call(null, fileid, (err) => (err ? reject(err) : resolve(undefined))))
    await this.graph.put(target)
    if(this.root.getId() === target.getId() && this.root.getFeed() === target.getFeed()) {
      this.root = target
    } else {
      await this.createPath(name, target)
    }

    debug(`created directory ${name} at hyper://${feed}${fileid}`)

    return target
  }

  public async find(path: string) {
    const vertex = latestWrite(<Vertex<DriveGraphObject>[]>await this.graph.queryPathAtVertex(path, this.root, undefined, thombstoneReductor).generator().destruct(onError))
    if (!vertex) return null

    const file = vertex.getContent()
    if (!file) throw new Error('vertex is not of type file or directory, it has no content at all')
    if (file.typeName === GraphObjectTypeNames.THOMBSTONE) return { vertex, id: 0, feed: '', path: '', version: 0, mkey: null, fkey: null } // file has been deleted
    if (!file.filename) throw new Error('vertex is not of type file or directory, it does not have a filename url')
    const parsed = parseUrl(file.filename)
    return { vertex, ...parsed }

    function onError(err: Error) {
      console.error('failed to find vertex for path ' + path)
      throw err
    }

    function thombstoneReductor(arr: QueryState<DriveGraphObject>[]): QueryState<DriveGraphObject>[] {
      arr.sort((a,b) => (a.value.getContent()?.timestamp || 0) - (b.value.getContent()?.timestamp || 0))
      if(arr[0].value.getContent()?.typeName === GraphObjectTypeNames.THOMBSTONE) {
        return []
      } else {
        return arr
      }
    }
  }

  public lstat(
    vertex: Vertex<DriveGraphObject>,
    path,
    encrypted: boolean,
    trie?,
    file?: boolean
  ): Promise<{ stat: Stat; trie: MountableHypertrie; contentFeed: Feed }> {
    const self = this
    const opts = { file: !!file, db: { trie, encrypted, hidden: !!encrypted } }
    const isFile = vertex.getContent()?.typeName === GraphObjectTypeNames.FILE
    const isDirectory = vertex.getContent()?.typeName === GraphObjectTypeNames.DIRECTORY
    return new Promise((resolve, reject) => {
      if (trie && trie !== self.drive.db) {
        trie.get(path, opts.db, onRemoteStat)
      } else {
        this.drive.lstat(path, opts, onStat)
      }

      function onStat(err: Error, stat: Stat, passedTrie) {
        if (err) return reject(err)
        if (stat) {
          stat.isFile = isFile
          stat.isDirectory = isDirectory
        }
        if (stat && !passedTrie) {
          return resolve({ stat, trie: passedTrie, contentFeed: undefined })
        }
        self.drive._getContent(passedTrie.feed, (err, contentState) => {
          if (err) return reject(err)
          else resolve({ stat, trie: passedTrie, contentFeed: contentState.feed })
        })
      }

      function onRemoteStat(err, node, trie) {
        if (err) return reject(err)
        // vanilla hyperdrive mounts are not supported yet
        if (!node && opts.file) return reject(new FileNotFound(path))
        if (!node) return onStat(null, TrieStat.directory(), trie) // TODO: modes?
        let st: Stat
        try {
          st = <Stat>TrieStat.decode(node.value)
        } catch (err) {
          return reject(err)
        }
        const writingFd = self.drive._writingFds.get(path)
        if (writingFd) {
          st.size = writingFd.stat.size
        }
        onStat(null, st, trie)
      }
    })
  }

  public async unlink(name: string) {
    const path = name.split('/').filter((p) => p.length > 0)
    if (path.length === 0) throw new Error('cannot unlink root')
    const parentPath = path.slice(0, path.length - 1).join('/')
    const filename = path[path.length - 1]

    //const file = await this.find(name)
    //const db = await this.getTrie(file.feed)
    //await new Promise((resolve, reject) => db.del(file.path, err => err ? reject(err) : resolve(undefined)))

    const thombstone = this.graph.create<Thombstone>()
    thombstone.setContent(new Thombstone())
    await this.graph.put(thombstone)

    let results = <Vertex<DriveGraphObject>[]>await this.graph.queryPathAtVertex(parentPath, this.root).vertices()
    for (const res of results) {
      const edges = res.getEdges(filename)
      for (let i = 0; i < edges.length; i++) {
        const vfeed = edges[i].feed?.toString('hex') || res.getFeed()
        const file = await this.graph.get(edges[i].ref, vfeed, (<{ key: Buffer }>edges[i].metadata).key)
        if (isDriveObjectOrShare(file)) {
          res.removeEdge(edges[i])
          res.addEdgeTo(thombstone, filename)
          await this.graph.put(res)
          debug(`unlinked edge to hyper://${file.getFeed()}/${file.getId()}`)
          return
        }
      }
    }
    debug('UNEXPECTED: unable to find edge to vertex')
  }

  public async getTrie(feedKey: string): Promise<MountableHypertrie> {
    if (feedKey === this.drive.key.toString('hex')) return this.drive.db
    if (this.tries.has(feedKey)) return <MountableHypertrie>this.tries.get(feedKey)
    const trie = <MountableHypertrie>await cryptoTrie(this.drive.corestore, this.crypto, feedKey)
    this.tries.set(feedKey, trie)
    return trie
  }

  async createPath(absolutePath: string, leaf: Vertex<DriveGraphObject>) {
    const {state} = await this.findWriteablePath(absolutePath)
    if(!state) {
      throw new Error('createPath: path is not writeable')
    }
    if(state instanceof SpaceQueryState) {
      const relativePath = state.getPathRelativeToSpace()
      return state.space.createEdgesToPath(relativePath)
    } else {
      return this.graph.createEdgesToPath(absolutePath, this.root, leaf)
    }
  }

  async findWriteablePath(absolutePath: string) {
    const self = this
    const parts = absolutePath.split('/').filter(p => p.trim().length > 0)
    const view = this.graph.factory.get(GRAPH_VIEW)
    return traverse(new QueryState(this.root, [], []), parts)


    async function traverse(state: QueryState<GraphObject>, path: string[]): Promise<{state: QueryState<GraphObject>, path: string[]} | undefined> {
      if(path.length === 0 || state.value.getEdges().length === 0) {
        const vertex = <Vertex<GraphObject>> state.value
        if(typeof vertex.getFeed === 'function' && vertex.getFeed() === self.root.getFeed()) {
          return {state, path}
        } else {
          return undefined
        }
      }

      const nextStates = await view.query(Generator.from([state])).out(path[0]).states()
      for(const next of nextStates) {
        const result = traverse(next, path.slice(1))
        if(result) return result
      }
      return undefined
    }
  }
}

function latestWrite(vertices: Vertex<DriveGraphObject>[]) {
  // TODO: use more sophisticated method - e.g. a view that makes sure there is only one vertex
  if (!vertices || vertices.length === 0) return null
  else if (vertices.length === 1) return vertices[0]
  else return vertices.sort((a, b) => a.getTimestamp() - b.getTimestamp())[0]
}

function isDriveObjectOrShare(vertex: Vertex<GraphObject>): boolean {
  if (!vertex.getContent()) return false
  const type = vertex.getContent().typeName
  return type === GraphObjectTypeNames.DIRECTORY || type === GraphObjectTypeNames.FILE || type === GraphObjectTypeNames.THOMBSTONE || type === SHARE_GRAPHOBJECT
}
