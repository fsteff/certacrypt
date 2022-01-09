import { CB0, Hyperdrive, shareMetaData, spaceMetaData, Stat } from './types'
import { CertaCryptGraph } from 'certacrypt-graph'
import { Generator, GraphObject, GRAPH_VIEW, QueryState, Vertex } from 'hyper-graphdb'
import { Directory, DriveGraphObject, File, GraphObjectTypeNames, Thombstone } from './graphObjects'
import { FileNotFound, PathAlreadyExists } from 'hyperdrive/lib/errors'
import { cryptoTrie } from './crypto'
import { Cipher, ICrypto } from 'certacrypt-crypto'
import MountableHypertrie from 'mountable-hypertrie'
import { Feed } from 'hyperobjects'
import { Stat as TrieStat } from 'hyperdrive-schemas'
import { parseUrl, parseUrlResults } from './url'
import { debug } from './debug'
import { CollaborationSpace, SpaceQueryState } from './space'
import { createUrl, URL_TYPES } from '..'
import { VirtualDriveShareVertex, DriveShares } from './driveshares'

export class MetaStorage {
  private readonly drive: Hyperdrive
  private readonly graph: CertaCryptGraph
  private root: Vertex<DriveGraphObject>
  private readonly tries: Map<string, MountableHypertrie>
  private readonly crypto: ICrypto
  private currentIdCtr = 0
  private shares: DriveShares

  constructor(drive: Hyperdrive, graph: CertaCryptGraph, root: Vertex<DriveGraphObject>, crypto: ICrypto) {
    this.drive = drive
    this.graph = graph
    this.root = root
    this.crypto = crypto
    this.tries = new Map<string, MountableHypertrie>()
  }

  async updateRoot(root?: Vertex<Directory>) {
    if (root) {
      this.root = root
    } else {
      this.root = <Vertex<Directory>>await this.graph.get(this.root.getId(), this.root.getFeed())
    }
    return <Vertex<Directory>>this.root
  }

  async setDriveShares(shares: DriveShares) {
    this.shares = shares
  }

  private async uniqueFileId() {
    const nodes = <{ seq: number; key: string; value: Buffer }[]>(
      await new Promise((resolve, reject) => this.drive.db.list('.enc', { hidden: true }, (err, res) => (err ? reject(err) : resolve(res))))
    )
    let idCtr = this.currentIdCtr + 1
    nodes.map((node) => parseInt(node.key.split('/', 2)[1])).forEach((id) => (idCtr = Math.max(idCtr, id + 1)))
    this.currentIdCtr = idCtr
    return '/.enc/' + idCtr
  }

  async readableFile(filename: string, encrypted = true) {
    const file = await this.find(filename, false)
    if (!file) throw new FileNotFound(filename)

    const { vertex, feed, path, mkey, fkey, space, share } = file
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

    const spaceMeta = space ? await this.getSpaceMetaData(space) : undefined

    debug(`created readableFile ${filename} from ${encrypted ? 'encrypted' : 'public'} ${stat.isFile ? 'file' : 'directory'} hyper://${feed}${path}`)

    return { path, trie, stat, contentFeed, spaceMeta, space, share }
  }

  async writeableFile(filename: string, encrypted = true): Promise<{ path: string; fkey?: Buffer }> {
    let parsedFile = await this.find(filename, true)
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

    const created = await this.createPath(filename, vertex)
    // reload root to be sure
    this.root = <Vertex<DriveGraphObject>>await this.graph.get(this.root.getId(), this.root.getFeed())

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

    const writeable = await this.findWriteablePath(name)
    const vertex = <Vertex<Directory>>(writeable?.remainingPath.length === 0 ? writeable?.state.value : undefined)
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
    if (this.root.getId() === target.getId() && this.root.getFeed() === target.getFeed()) {
      this.root = target
    } else {
      await this.createPath(name, target)
    }

    debug(`created directory ${name} at hyper://${feed}${fileid}`)

    return target
  }

  public async find(
    path: string,
    writeable: boolean
  ): Promise<{ vertex: Vertex<DriveGraphObject>; space?: CollaborationSpace; share?: shareMetaData } & parseUrlResults> {
    let vertex: Vertex<DriveGraphObject>
    let space: CollaborationSpace
    let shareMeta: shareMetaData

    if (writeable) {
      const writeablePath = await this.findWriteablePath(path)
      if (!writeablePath) {
        throw new Error('file or path is not writeable: ' + path)
      }
      space = (<SpaceQueryState>writeablePath.state).space
      if (writeablePath.remainingPath?.length === 0) {
        vertex = <Vertex<DriveGraphObject>>writeablePath.state.value
      }
    } else {
      //if(path.endsWith('/.')) path = path.substring(0, path.length - 1)
      const states = await this.graph
        .queryPathAtVertex(path, this.root, undefined, thombstoneReductor)
        .matches((v) => !!v.getContent())
        .generator()
        .rawQueryStates(onError)
      vertex = this.latestWrite(<Vertex<DriveGraphObject>[]>states.map((s) => s.value))
      space = (<SpaceQueryState>states.find((s) => s.value.equals(vertex)))?.space

      const state = states.find((s) => s.value === vertex)
      if (state && state.path.length > 1 && state.path[state.path.length - 2].vertex instanceof VirtualDriveShareVertex) {
        const prev = <VirtualDriveShareVertex>state.path[state.path.length - 2].vertex
        shareMeta = prev.getShareMetaData().find((s) => s.path === path)
        if (!shareMeta) {
          console.warn('no share metadata found for ' + path)
        }
      }
    }

    if (!vertex) return null

    const file = vertex.getContent()
    if (!file) throw new Error('vertex is not of type file or directory, it has no content at all in path ' + path)
    if (file.typeName === GraphObjectTypeNames.THOMBSTONE) return { vertex, id: 0, feed: '', path: '', version: 0, mkey: null, fkey: null } // file has been deleted
    if (!file.filename) throw new Error('vertex is not of type file or directory, it does not have a filename url in path ' + path)
    const parsed = parseUrl(file.filename)
    return { vertex, space, share: shareMeta, ...parsed }

    function onError(err: Error) {
      console.error('failed to find vertex for path ' + path)
      throw err
    }

    function thombstoneReductor(arr: QueryState<DriveGraphObject>[]): QueryState<DriveGraphObject>[] {
      if (!arr || arr.length === 0) return []
      arr.sort((a, b) => (b.value.getContent()?.timestamp || 0) - (a.value.getContent()?.timestamp || 0))
      if (arr[0].value.getContent()?.typeName === GraphObjectTypeNames.THOMBSTONE) {
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
    const filename = path[path.length - 1]

    const thombstone = this.graph.create<Thombstone>()
    thombstone.setContent(new Thombstone())
    await this.graph.put(thombstone)

    let results = <Vertex<DriveGraphObject>[]>await this.graph.queryPathAtVertex(name, this.root).vertices()
    if (results.length === 0) {
      throw new Error('File not found, cannot unlink')
    }

    const writeable = await this.findWriteablePath(name)
    if (!writeable) {
      throw new Error('File is not writeable, cannot unlink')
    }
    if (writeable.remainingPath.length === 0) {
      const file = <Vertex<GraphObject>>writeable.state.value
      const parent = <Vertex<GraphObject>>writeable.state.path[writeable.state.path.length - 2].vertex
      parent.replaceEdgeTo(file, (_edge) => {
        return {
          ref: thombstone.getId(),
          label: filename,
          metadata: { key: this.graph.getKey(thombstone) }
        }
      })
      await this.graph.put(parent)
      debug(`placed thombstone to ${name} and unlinked edge to hyper://${file.getFeed()}/${file.getId()}`)
    } else {
      await this.createPath(name, thombstone)
      debug('placed thombstone to ' + name)
    }
  }

  public async getTrie(feedKey: string): Promise<MountableHypertrie> {
    if (feedKey === this.drive.key.toString('hex')) return this.drive.db
    if (this.tries.has(feedKey)) return <MountableHypertrie>this.tries.get(feedKey)
    const trie = <MountableHypertrie>await cryptoTrie(this.drive.corestore, this.crypto, feedKey)
    this.tries.set(feedKey, trie)
    return trie
  }

  async createPath(absolutePath: string, leaf: Vertex<DriveGraphObject>) {
    const path = await this.findWriteablePath(absolutePath)
    if (!path) {
      throw new Error('createPath: path is not writeable')
    }
    const lastWriteable = <Vertex<GraphObject>>path.state.value
    // update vertices to update timestamps & rotate keys
    if (this.shares) {
      if (path.state instanceof SpaceQueryState && path.state.space.root.getFeed() !== this.root.getFeed()) {
        await path.state.space.updateReferrer()
      }
      await this.shares.rotateKeysTo(lastWriteable)
    } else {
      const pathWriteables = path.state.path
        .slice(0, path.state.path.length - 1)
        .map((p) => <Vertex<GraphObject>>p.vertex)
        .filter((p) => typeof p.getFeed === 'function' && p.getFeed() === lastWriteable.getFeed() && typeof p.encode === 'function')
      if (pathWriteables.length > 0) await this.graph.put(pathWriteables)
    }

    return this.graph.createEdgesToPath(path.remainingPath.join('/'), lastWriteable, leaf)
  }

  async findWriteablePath(absolutePath: string): Promise<{ state: QueryState<GraphObject>; remainingPath: string[] }> {
    const self = this
    const parts = absolutePath.split('/').filter((p) => p.trim().length > 0)
    return traverse(new QueryState(this.root, [], [], this.graph.factory.get(GRAPH_VIEW)), parts)

    async function traverse(state: QueryState<GraphObject>, path: string[]): Promise<{ state: QueryState<GraphObject>; remainingPath: string[] } | undefined> {
      let nextStates = path.length > 0 ? await out(state, path[0]) : []
      if (nextStates.length === 0) {
        const vertex = <Vertex<GraphObject>>state.value
        if (typeof vertex.getFeed === 'function' && vertex.getFeed() === self.root.getFeed()) {
          return { state, remainingPath: path }
        } else {
          return undefined
        }
      }

      for (const next of nextStates) {
        const result = await traverse(next, path.slice(1))
        if (result) return result
      }

      // in case the user's PSV has not been written to (yet), create a root dir
      for (const next of nextStates) {
        if (!(next instanceof SpaceQueryState)) continue
        // get the owner's root dir id+feed
        const spaceOwnerEdge = next.space.root
          .getEdges('.')
          .map((edge) => {
            return { id: edge.ref, feed: edge.feed?.toString() || next.space.root.getFeed() }
          })
          .filter((e) => e.feed === next.space.root.getFeed())[0]
        if (!spaceOwnerEdge) continue
        // check if current vertex is the owner's root dir
        const v = <Vertex<GraphObject>>next.value
        if (v.getId() !== spaceOwnerEdge.id || v.getFeed() !== spaceOwnerEdge.feed) continue
        // get writer root dir
        const writeable = await getOrCreateWriteable(next, path, state)
        if (writeable) return await traverse(writeable, path.slice(1))
      }

      return undefined
    }

    async function getOrCreateWriteable(next: SpaceQueryState, path: string[], state: QueryState<GraphObject>) {
      const space = (<SpaceQueryState>next).space
      let writeable: Vertex<GraphObject>
      try {
        writeable = await space.tryGetWriteableRoot()
        // if PSV has not been written to, this creates an empty vertex
        if (!writeable) {
          writeable = await space.createWriteableRoot()
        }
        return new SpaceQueryState(writeable, state.path, state.rules, state.view, space).nextState(writeable, path[0], writeable.getFeed(), state.view)
      } catch (err) {
        debug('findWriteablePath: no permissions to write to space ' + space.root.getId() + '@' + space.root.getFeed())
      }
    }

    async function out(state: QueryState<GraphObject>, label: string) {
      return state.view
        .query(Generator.from([state]))
        .out(label)
        .states()
    }
  }

  async getSpaceMetaData(space: CollaborationSpace): Promise<spaceMetaData> {
    const owner = space.getOwnerUrl()
    const writers = await space.getWriterUrls()
    const isWriteable = space.userHasWriteAccess()
    const spaceRoot = createUrl(space.root, this.graph.getKey(space.root), undefined, URL_TYPES.SPACE)
    return { space: spaceRoot, owner, writers, isWriteable }
  }

  latestWrite(vertices: Vertex<DriveGraphObject>[]) {
    // TODO: use more sophisticated method - e.g. a view that makes sure there is only one vertex
    if (!vertices || vertices.length === 0) return null
    else if (vertices.length === 1) return vertices[0]
    return vertices.sort((a, b) => timestamp(b) - timestamp(a))[0]

    function timestamp(vertex: Vertex<GraphObject>) {
      if (typeof vertex.getTimestamp === 'function') return vertex.getTimestamp()
      else return 0
    }
  }

  latestWrites(states: QueryState<GraphObject>[]) {
    if (!states || states.length < 2) return states

    const map = new Map<String, QueryState<GraphObject>>()
    for (const state of states) {
      const path = state.path.map((p) => p.label).join('/')
      if (map.has(path)) {
        const other = map.get(path)
        const newer = [state, other].sort((a, b) => timestamp(b) - timestamp(a))[0]
        map.set(path, newer)
      } else {
        map.set(path, state)
      }
    }
    return [...map.values()]

    function timestamp(state: QueryState<GraphObject>) {
      const vertex = <Vertex<GraphObject>>state.value
      if (typeof vertex.getTimestamp === 'function') return vertex.getTimestamp()
      else return 0
    }
  }

  rotateKeys(vertex: Vertex<GraphObject>) {}
}
