import { Edge, Generator, GraphObject, IVertex, QueryResult, QueryState, Vertex, View } from 'hyper-graphdb'
import { CertaCryptGraph, SHARE_VIEW } from 'certacrypt-graph'
import { CacheDB } from './cacheDB'
import { CommShare, COMM_PATHS, COMM_VIEW, VirtualCommShareVertex } from './communication'
import { parseUrl } from './url'

export const DRIVE_SHARE_VIEW = 'DriveShareView'

export class DriveShareView extends View<GraphObject> {
  public readonly viewName = DRIVE_SHARE_VIEW

  constructor(readonly cacheDb: CacheDB, readonly graph: CertaCryptGraph, readonly socialRoot: Vertex<GraphObject>, contentEncoding, factory, transactions?) {
    super(graph.core, contentEncoding, factory, transactions)
  }

  public async get(edge: Edge & { feed: Buffer }, state: QueryState<GraphObject>): Promise<QueryResult<GraphObject>> {
    const feed = edge.feed.toString('hex')

    const shareEdges: Edge[] = await this.getShareEdges(state)

    const tr = await this.getTransaction(feed)
    const realVertex = await this.db.getInTransaction<GraphObject>(edge.ref, this.codec, tr, feed)
    return [Promise.resolve(this.toResult(new VirtualDriveShareVertex(shareEdges.concat(realVertex.getEdges()), realVertex), edge, state))]
  }

  private getShareEdges(state: QueryState<GraphObject>): Promise<Array<Edge & { feed: Buffer }>> {
    const view = this.getView(COMM_VIEW)
    return this.query(Generator.from([state.mergeStates(this.socialRoot)]))
      .out(COMM_PATHS.COMM_TO_RCV_SHARES, view)
      .generator()
      .values((err) => console.error('DriveShareView: failed to load share:' + err))
      .map((v) => (<VirtualCommShareVertex>v).getContent())
      .map((c) => this.uniqueEdge(c))
      .filter(async (e) => e !== null)
      .destruct()
  }

  private uniqueEdge(share: CommShare): Edge & { feed: Buffer } {
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

export class VirtualDriveShareVertex implements IVertex<GraphObject> {
  constructor(private edges: Edge[], private realVertex: Vertex<GraphObject>) {}

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
}
