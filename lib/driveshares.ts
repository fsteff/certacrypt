import { Edge, Generator, GraphObject, GRAPH_VIEW, IVertex, QueryResult, QueryState, Vertex, VertexQueries, View, ViewGetResult } from 'hyper-graphdb'
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

  public async get(edge: Edge & {feed: Buffer}, state: QueryState<GraphObject>): ViewGetResult<GraphObject> {
    const feed = edge.feed.toString('hex')

    if (edge.view) {
      const view = this.getView(edge.view)
      return view.get({...edge, view: undefined}, state)
    }
    const edges = await this.getShareEdges()

    const tr = await this.getTransaction(feed)
    const realVertex = await this.db.getInTransaction<GraphObject>(edge.ref, this.codec, tr, feed)
    return this.toResult(new VirtualDriveShareVertex(edges.concat(realVertex.getEdges()), realVertex), edge, state)
  }

  private getShareEdges(): Promise<Edge[]> {
    const view = this.getView(COMM_VIEW)
    return view
      .query(Generator.from([new QueryState(<IVertex<GraphObject>>this.socialRoot, [], [], view)]))
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
