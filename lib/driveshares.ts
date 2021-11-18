import { Edge, Generator, GraphObject, GRAPH_VIEW, IVertex, QueryResult, QueryState, Vertex, VertexQueries, View } from 'hyper-graphdb'
import { CertaCryptGraph } from 'certacrypt-graph'
import { CacheDB } from './cacheDB'
import { CommShare, COMM_PATHS, COMM_VIEW, VirtualCommShareVertex } from './communication'
import { parseUrl } from './url'

export const DRIVE_SHARE_VIEW = 'DriveShareView'

export class DriveShareView extends View<GraphObject> {
  public readonly viewName = DRIVE_SHARE_VIEW

  constructor(readonly cacheDb: CacheDB, readonly graph: CertaCryptGraph, readonly socialRoot: Vertex<GraphObject>, contentEncoding, factory, transactions?) {
    super(graph.core, contentEncoding, factory, transactions)
  }

  public async out(state: QueryState<GraphObject>, label?: string):  Promise<QueryResult<GraphObject>> {
    return this.getView(GRAPH_VIEW).out(state, label)
  }

  public async get(feed: string | Buffer, id: number, version?: number, viewDesc?: string, metadata?: Object): Promise<IVertex<GraphObject>> {
    feed = Buffer.isBuffer(feed) ? feed.toString('hex') : feed

    if (viewDesc) {
      const view = this.getView(viewDesc)
      return view.get(feed, id, version, undefined, metadata)
    }
    const edges = await this.getShareEdges()

    const tr = await this.getTransaction(feed, version)
    const realVertex = await this.db.getInTransaction<GraphObject>(id, this.codec, tr, feed)
    return new VirtualDriveShareVertex(edges.concat(realVertex.getEdges()), realVertex)
  }

  private getShareEdges(): Promise<Edge[]> {
    return this.getView(COMM_VIEW)
      .query(Generator.from([new QueryState(<IVertex<GraphObject>>this.socialRoot, [], [])]))
      .out(COMM_PATHS.COMM_TO_RCV_SHARES)
      .generator()
      .values((err) => console.error('DriveShareView: failed to load share:' + err))
      .map((v) => (<VirtualCommShareVertex>v).getContent())
      .map((c) => this.uniqueEdge(c))
      .filter(async (e) => e !== null)
      .destruct()
  }

  private uniqueEdge(share: CommShare): Edge {
    const userParsed = parseUrl(share.sharedBy)
    const userLabel = userParsed.id + '@' + userParsed.feed
    const shareLabel = share.share.getId() + '@' + share.share.getFeed()
    const label = encodeURIComponent(userLabel + '/' + shareLabel)
    const edge = share.share.getEdges('share')[0]
    if (!edge) return null

    return { ...edge, label }
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
