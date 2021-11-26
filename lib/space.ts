import {
  IVertex,
  QueryState,
  QueryPath,
  QueryRule,
  Restriction,
  Vertex,
  GRAPH_VIEW,
  GraphObject,
  View,
  QueryResult,
  Edge,
  Errors,
  Generator,
  STATIC_VIEW,
  ValueGenerator
} from 'hyper-graphdb'
import { CertaCryptGraph } from 'certacrypt-graph'
import { DriveGraphObject, GraphObjectTypeNames, PreSharedGraphObject, SpaceGraphObject, UserRoot } from './graphObjects'
import { User } from './user'
import { ReferrerEdge, REFERRER_VIEW, ReferrerView } from './referrer'
import { parseUrl } from './url'
import { debug } from './debug'

export const SPACE_VIEW = 'SpaceView'

export class SpaceQueryState extends QueryState<GraphObject> {
  constructor(
    value: IVertex<GraphObject>,
    path: QueryPath<GraphObject>,
    rules: QueryRule<GraphObject>[],
    view: View<GraphObject>,
    readonly space: CollaborationSpace
  ) {
    super(value, path, rules, view)
  }

  nextState(vertex: IVertex<GraphObject>, label: string, feed: string, view: View<GraphObject>): SpaceQueryState {
    return new SpaceQueryState(vertex, this.path.concat([{ label, vertex, feed }]), this.rules, view || this.view, this.space)
  }

  addRestrictions(vertex: IVertex<GraphObject>, restrictions: Restriction[]): SpaceQueryState {
    const newRules = new QueryRule<GraphObject>(vertex, restrictions)
    return new SpaceQueryState(this.value, this.path, this.rules.concat(newRules), this.view, this.space)
  }

  mergeStates(value?: IVertex<GraphObject>, path?: QueryPath<GraphObject>, rules?: QueryRule<GraphObject>[], view?: View<GraphObject>) {
    return new SpaceQueryState(value || this.value, path || this.path, rules || this.rules, view || this.view, this.space)
  }

  setSpace(space: CollaborationSpace) {
    return new SpaceQueryState(this.value, this.path, this.rules, this.view, space)
  }
}

export class CollaborationSpace {
  protected readonly defaultFeed: Promise<string>

  constructor(readonly graph: CertaCryptGraph, readonly root: Vertex<SpaceGraphObject>, readonly user: User) {
    this.defaultFeed = graph.core.getDefaultFeedId().then((feed) => feed.toString('hex'))
  }

  static async CreateSpace(
    graph: CertaCryptGraph,
    user: User,
    parentVertex: Vertex<GraphObject>,
    childVertex: Vertex<DriveGraphObject>,
    parentSpace?: CollaborationSpace
  ) {
    if (parentSpace && parentSpace.root.getFeed() !== (await parentSpace.defaultFeed)) {
      throw new Error('Insufficient permissions to create sub-space')
    }

    const root = graph.create<SpaceGraphObject>()
    const spaceObj = new SpaceGraphObject()
    spaceObj.owner = user.getPublicUrl()
    root.setContent(spaceObj)
    await graph.put(root)

    root.addEdgeTo(childVertex, '.')
    await graph.put(root)

    parentVertex.replaceEdgeTo(childVertex, (edge) => {
      return {
        ...edge,
        ref: root.getId(),
        view: SPACE_VIEW
      }
    })
    await graph.put(parentVertex)
    return new CollaborationSpace(graph, root, user)
  }

  async createEdgesToPath(path: string, leaf?: Vertex<DriveGraphObject>) {
    let writeable = await this.tryGetWriteableRoot()
    if (!writeable) {
      writeable = await this.createWriteableRoot()
    }
    return this.graph.createEdgesToPath(path, writeable, leaf)
  }

  async addWriter(user: User, restrictions?: Restriction[]) {
    if (this.user.publicRoot.getFeed() !== this.root.getFeed()) {
      throw new Error('insufficient permissions, user is not the owner of the space')
    }

    if (this.userHasWriteAccess(user)) {
      throw new Error('user already has write access to space')
    }

    restrictions = Array.isArray(restrictions)
      ? restrictions
      : [{ rule: user.publicRoot.getFeed() + '/**/*', except: { rule: user.publicRoot.getFeed() + '/.' } }]
    await user.referToPresharedVertex(this.root, '.', restrictions)
  }

  userHasWriteAccess(user?: User) {
    const publicRoot = user?.publicRoot || this.user.publicRoot
    if (this.root.getFeed() === publicRoot.getFeed()) return true
    return this.root
      .getEdges('.')
      .filter((e) => e.view === REFERRER_VIEW && e.feed)
      .map((e) => e.feed.toString('hex'))
      .includes(publicRoot.getFeed())
  }

  async getWriters() {
    return Promise.all((await this.getWriterUrls()).map((url) => this.getUserByUrl(url)))
  }

  async getWriterUrls() {
    const self = this
    const view = this.graph.factory.get(STATIC_VIEW)
    const urls = await view
      .query(Generator.from([new QueryState(this.root, [], [], view)]))
      .out('.')
      .matches((v) => v.getContent()?.typeName === GraphObjectTypeNames.PRESHARED)
      .generator()
      .values(onError)
      .map((v) => (<IVertex<PreSharedGraphObject>>v).getContent().owner)
      .filter((url) => url && url.trim().length > 0)
      .destruct()
    return [this.getOwnerUrl()].concat(urls)

    function onError(err: Error) {
      console.error(`getWriterUrls: Failed to get Vertex for PreSharedGraphObject in Space ${self.root.getId()}@${self.root.getFeed()}: ${err}`)
    }
  }

  async getOwner() {
    return this.getUserByUrl(this.getOwnerUrl())
  }

  getOwnerUrl() {
    return this.root.getContent()?.owner
  }

  async tryGetWriteableRoot(): Promise<Vertex<GraphObject>> {
    const feed = await this.defaultFeed
    if (feed === this.root.getFeed()) {
      const graphView = this.graph.factory.get(GRAPH_VIEW)
      const edges = this.root.getEdges('.').filter((e) => !e.feed || e.feed?.toString('hex') === feed)
      if (edges.length === 0) {
        return undefined
      }
      return <Vertex<GraphObject>>await ValueGenerator.from(
        await graphView.get({ ...edges[0], feed: Buffer.from(feed, 'hex') }, new QueryState(this.root, [], [], this.graph.factory.get(SPACE_VIEW)))
      )
        .map(async (r) => (await r).result)
        .first()
    }

    const referrerView = this.graph.factory.get(REFERRER_VIEW)
    const edges = (<ReferrerEdge[]>this.root.getEdges('.')).filter((e) => e.metadata.refKey && e.feed?.toString('hex') === feed)
    if (edges.length === 0) {
      return undefined
    }
    const dirs = await referrerView.get(<Edge & { feed: Buffer }>edges[0], new QueryState(this.root, [], [], this.graph.factory.get(SPACE_VIEW)))
    if (dirs.length === 0) {
      debug('tryGetWriteableRoot: empty referrer for feed ' + feed)
      return undefined
    }
    return <Vertex<GraphObject>>(await dirs[0]).result
  }

  async createWriteableRoot() {
    const feed = await this.defaultFeed
    const edge = <ReferrerEdge | undefined>this.root.getEdges('.').filter((e) => e.feed?.toString('hex') === feed)[0]
    if (!edge) {
      throw new Error('Insufficient permissions to write to space')
    }
    const created = await this.user.writeToPresharedVertex(edge)
    debug('createWriteableRoot: created for space ' + this.root.getId() + '@' + this.root.getFeed() + ' and feed ' + feed)
    return created
  }

  private async getUserByUrl(url: string) {
    const { feed, id, key } = parseUrl(url)
    const root = <Vertex<UserRoot>>await this.graph.get(id, feed, key)
    return new User(root, this.graph)
  }
}

export class CollaborationSpaceView extends View<GraphObject> {
  readonly viewName = SPACE_VIEW

  constructor(readonly user: User, readonly graph: CertaCryptGraph, contentEncoding, factory, transactions?) {
    super(graph.core, contentEncoding, factory, transactions)
  }

  protected getView(name?: string): View<GraphObject> {
    if (!name) return this
    // do not fall back to GRAPH_VIEW as default view
    else return this.factory.get(name, this.transactions)
  }

  public async get(edge: Edge & { feed: Buffer }, state: QueryState<GraphObject>): Promise<QueryResult<GraphObject>> {
    const feed = edge.feed.toString('hex')

    if (edge.view) {
      const view = this.getView(edge.view)
      return view.get({ ...edge, view: undefined }, state).catch((err) => {
        throw new Errors.VertexLoadingError(err, <string>feed, edge.ref, edge.version)
      })
    }

    const tr = await this.getTransaction(feed)
    const vertex = await this.db.getInTransaction<GraphObject>(edge.ref, this.codec, tr, feed).catch((err) => {
      throw new Errors.VertexLoadingError(err, <string>feed, edge.ref, edge.version, edge.view)
    })

    if (vertex.getContent()?.typeName === GraphObjectTypeNames.SPACE) {
      let space = new CollaborationSpace(this.graph, <Vertex<SpaceGraphObject>>vertex, this.user)
      state = new SpaceQueryState(vertex, state.path, state.rules, this, space)
      const resultingStates = await this.out(state, '.')
      return resultingStates.map(async (next) => {
        const res = await next
        return this.toResult(res.result, edge, state)
      })
    } else {
      return [Promise.resolve(this.toResult(vertex, edge, state))]
    }
  }
}
