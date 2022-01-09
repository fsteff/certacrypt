import { Edge, Generator, GraphObject, GRAPH_VIEW, IVertex, QueryPath, QueryResult, QueryState, STATIC_VIEW, Vertex, View } from 'hyper-graphdb'
import { CertaCryptGraph, ShareGraphObject, SHARE_VIEW } from 'certacrypt-graph'
import { CacheDB } from './cacheDB'
import { CommShare, COMM_PATHS, COMM_VIEW, VirtualCommShareVertex } from './communication'
import { parseUrl } from './url'
import { shareMetaData } from './types'
import { createUrl, CryptoHyperdrive, Shares, URL_TYPES } from '..'
import { Primitives } from 'certacrypt-crypto'
import { SpaceQueryState } from './space'
import { FileNotFound } from 'hyperdrive/lib/errors'
import { debug } from './debug'

export const DRIVE_SHARE_VIEW = 'DriveShareView'

export class DriveShares {
  private drive: CryptoHyperdrive

  constructor(readonly graph: CertaCryptGraph, readonly shares: Shares) {}

  async mountAt(drive: CryptoHyperdrive, parentVertex: Vertex<GraphObject>, childLabel: string) {
    this.drive = drive
    this.drive.setShares(this)

    let found = false
    let existing = false
    const edges = parentVertex.getEdges().map((edge) => {
      if (edge.label === childLabel) {
        if(edge.view === DRIVE_SHARE_VIEW) existing = true
        edge.view = DRIVE_SHARE_VIEW
        found = true
      }
      return edge
    })
    if (!found) {
      throw new Error('Failed to mount driveshares, no such child')
    }
    // alread mounted
    if(existing) return

    parentVertex.setEdges(edges)
    await this.graph.put(parentVertex)
  }

  async rotateKeysTo(updatedVertex: Vertex<GraphObject>) {
    const pathVertices = await this.findWriteableVerticesOnPathTo(updatedVertex)
    const affectedShares = await this.shares.findSharesTo(pathVertices.slice(1))

    // TODO: referrer rotation for spaces

    // do not rotate root vertex & ones that are psv-defined
    for (const vertex of pathVertices.slice(1)) {
      this.rotateKey(vertex)
    }

    // edge keys are updated on put()
    const rotated = pathVertices.concat(affectedShares)
    if(rotated.length > 0) await this.graph.put(rotated)
  }

  async rotateKeysToPath(path: string) {
    const root = await this.drive.updateRoot()
    const states = await this.graph.queryPathAtVertex(path, root).states()
    const writeable = states.filter((s) => {
      const v = <Vertex<GraphObject>>s.value
      return typeof v.getFeed === 'function' && v.getFeed() === root.getFeed()
    })
    if (writeable.length === 0) throw new FileNotFound(path)
    return this.rotateKeysTo(<Vertex<GraphObject>>writeable[0].value)
  }

  async revokeShare(share: Vertex<ShareGraphObject>) {
    const content = share.getContent() || new ShareGraphObject()
    content.revoked = true
    share.setContent(content)
    await this.graph.put(share)
  }

  private rotateKey(vertex: Vertex<GraphObject>) {
    const genkey = Primitives.generateEncryptionKey()
    this.graph.registerVertexKey(vertex.getId(), vertex.getFeed(), genkey)
  }

  async findWriteableVerticesOnPathTo(target: Vertex<GraphObject>): Promise<Vertex<GraphObject>[]> {
    const root = await this.drive.updateRoot()
    const graphView = this.graph.factory.get(GRAPH_VIEW)
    const result = await this.findTarget(target, new QueryState(root, [{label: '', vertex: root, feed: root.getFeed()}], [], graphView), [])
    if (!result || result.path.length === 0) {
      debug('no vertices for found that need key rotation')
      return []
    }

    const path = result.path.map((p) => <Vertex<GraphObject>>p.vertex)
    if (result instanceof SpaceQueryState) {
      const space = result.space.root
      if(space.getFeed() === root.getFeed()) {
        path.push(space)
        await result.space.rotateReferrerKeys()
      }
    }

    const drivesharesIdx = path.findIndex(v => v instanceof VirtualDriveShareVertex)
    if(drivesharesIdx >= 0) {
      path.splice(0, drivesharesIdx + 1)
    }

    return path.filter((v) => this.isWriteable(v, root.getFeed()))
  }

  async getDrivePathTo(target: Vertex<GraphObject>): Promise<string> {
    const root = await this.drive.updateRoot()
    const graphView = this.graph.factory.get(GRAPH_VIEW)
    const result = await this.findTarget(target, new QueryState(root, [{label: '', vertex: root, feed: root.getFeed()}], [], graphView), [])
    return result.path.map((p) => p.label).join('/')
  }

  private async findTarget(
    target: Vertex<GraphObject>,
    state: QueryState<GraphObject>,
    visites: IVertex<GraphObject>[]
  ): Promise<QueryState<GraphObject> | undefined> {
    const nextStates = await state.view
      .query(Generator.from([state]))
      .out()
      .states()
    for (const state of nextStates) {
      if (state.value.equals(target)) return state

      if (visites.findIndex((v) => v.equals(state.value)) >= 0) continue
      visites.push(state.value)

      const result = await this.findTarget(target, state, visites)
      if (result) return result
    }
  }

  private isWriteable(v: Vertex<GraphObject>, rootFeed: string) {
    return typeof v.getFeed === 'function' && v.getFeed() === rootFeed && typeof v.encode === 'function'
  }
}

export class DriveShareView extends View<GraphObject> {
  public readonly viewName = DRIVE_SHARE_VIEW

  constructor(readonly cacheDb: CacheDB, readonly graph: CertaCryptGraph, readonly socialRoot: Vertex<GraphObject>, contentEncoding, factory, transactions?) {
    super(graph.core, contentEncoding, factory, transactions)
  }

  public async get(edge: Edge & { feed: Buffer }, state: QueryState<GraphObject>): Promise<QueryResult<GraphObject>> {
    const feed = edge.feed.toString('hex')

    const shareEdges = await this.getShareEdges(edge, state)
    const edges = shareEdges.map((s) => s.edge)
    const meta = shareEdges.map((s) => s.share)

    const tr = await this.getTransaction(feed)
    const realVertex = await this.db.getInTransaction<GraphObject>(edge.ref, this.codec, tr, feed)
    return [Promise.resolve(this.toResult(new VirtualDriveShareVertex(edges.concat(realVertex.getEdges()), realVertex, meta), edge, state))]
  }

  private async getShareEdges(prevEdge: Edge, state: QueryState<GraphObject>) {
    const path = [prevEdge.label].concat(state.path.map((p) => p.label)).join('/')
    const view = this.getView(COMM_VIEW)
    const shares = <VirtualCommShareVertex[]>await this.query(Generator.from([state.mergeStates(this.socialRoot)]))
      .out(COMM_PATHS.COMM_TO_RCV_SHARES, view)
      .generator()
      .values((err) => console.error('DriveShareView: failed to load share:' + err))
      .filter((v) => !!v.getContent())
      .destruct()

    const shareEdges = shares
      .map((v) => v.getContent())
      .map((c) => {
        const edge = this.uniqueEdge(c)
        return {
          share: {
            share: createUrl(c.share, this.graph.getKey(c.share), undefined, URL_TYPES.SHARE, c.name),
            owner: c.owner,
            name: c.name,
            path: '/' + path + '/' + edge.label,
            label: edge.label
          },
          edge
        }
      })

    return shareEdges
  }

  private uniqueEdge(share: CommShare): Edge {
    const userParsed = parseUrl(share.sharedBy)
    const userLabel = userParsed.id + '@' + userParsed.feed
    const shareLabel = share.share.getId() + '@' + share.share.getFeed()

    return {
      ref: share.share.getId(),
      feed: Buffer.from(share.share.getFeed(), 'hex'),
      label: encodeURIComponent(userLabel + '/' + shareLabel),
      metadata: { key: this.graph.getKey(share.share) },
      view: SHARE_VIEW
    }
  }
}

type shareMeta = shareMetaData & { label: string }

export class VirtualDriveShareVertex implements IVertex<GraphObject> {
  constructor(private edges: Edge[], private realVertex: Vertex<GraphObject>, private meta: shareMeta[]) {}

  getContent(): GraphObject {
    return this.realVertex.getContent()
  }
  getEdges(label?: string): Edge[] {
    return this.edges.filter((e) => !label || label === e.label)
  }
  equals<V>(other: IVertex<V>): boolean {
    return this.realVertex.equals(other)
  }

  getVersion() {
    return this.realVertex.getVersion()
  }
  getFeed() {
    return this.realVertex.getFeed()
  }
  getId() {
    return this.realVertex.getId()
  }
  getWriteable() {
    return this.realVertex.getWriteable()
  }
  getMetadata() {
    this.realVertex.getMetadata()
  }

  getShareMetaData() {
    return this.meta
  }
}
