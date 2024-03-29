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
} from '@certacrypt/hyper-graphdb'
import { CertaCryptGraph } from '@certacrypt/certacrypt-graph'
import { Directory, DriveGraphObject, GraphObjectTypeNames, PreSharedGraphObject, SpaceGraphObject, UserRoot } from './graphObjects'
import { User } from './user'
import { ReferrerEdge, REFERRER_VIEW, ReferrerView } from './referrer'
import { parseUrl } from './url'
import { debug } from './debug'
import { Primitives } from '@certacrypt/certacrypt-crypto'
import { Space } from '..'
import { VirtualDriveShareVertex } from './driveshares'

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

  async addWriter(user: User, restrictions?: Restriction[]) {
    if (this.user.publicRoot.getFeed() !== this.root.getFeed()) {
      throw new Error('insufficient permissions, user is not the owner of the space')
    }

    const refs = this.getUserReferrerEdges(user)
    if (refs.find((e) => !this.isUserReferrerPinned(e))) {
      throw new Error('user already has write access to space')
    }
    const pinned = refs.filter((e) => this.isUserReferrerPinned(e))
    if (pinned.length > 0) {
      const edges = this.root.getEdges()
      for (const pinnedEdge of pinned) {
        const idx = edges.findIndex((e) => e.ref === pinnedEdge.ref && e.feed === pinnedEdge.feed)
        pinnedEdge.restrictions = pinnedEdge.restrictions.map(patchPinRule)
        edges[idx] = pinnedEdge
        debug('removed pinning rules for user ' + ((await user.getProfile())?.username || user.publicRoot.getFeed()))
      }
      this.root.setEdges(edges)
      await this.graph.put(this.root)
    }

    restrictions = Array.isArray(restrictions)
      ? restrictions
      : [{ rule: user.publicRoot.getFeed() + '#0/**/*', except: { rule: user.publicRoot.getFeed() + '#0/*' } }]
    await user.referToPresharedVertex(this.root, '.', restrictions)

    function patchPinRule(rule: Restriction) {
      const patched = rule.rule.replace(/#[1-9]+/, '#0')
      return {
        rule: patched,
        except: rule.except ? patchPinRule(rule.except) : undefined
      }
    }
  }

  async revokeWriter(user: User) {
    if (!this.userHasWriteAccess(user)) throw new Error('user aready does not have write access')

    const version = user.publicRoot.getVersion() + 1 //+1 needed?
    const feed = user.publicRoot.getFeed()
    const feedPattern = feed + '#0'
    const newPattern = feed + '#' + version
    const edges = this.root.getEdges()

    for (const edge of edges) {
      if (edge.feed?.toString('hex') === feed && edge.restrictions) {
        for (const restriction of edge.restrictions) {
          patchRestriction(restriction)
        }
      }
    }
    this.root.setEdges(edges)
    await this.graph.put(this.root)
    debug(
      `space ${this.root.getId()}@${this.root.getFeed()} pinned version of user ${
        (await user.getProfile())?.username || user.publicRoot.getFeed()
      } to version ${version}`
    )

    function patchRestriction(restriction: Restriction) {
      restriction.rule = restriction.rule.replace(feedPattern, newPattern)
      if (restriction.except) patchRestriction(restriction.except)
    }
  }

  userHasWriteAccess(user?: User): boolean {
    const publicRoot = user?.publicRoot || this.user.publicRoot
    if (this.root.getFeed() === publicRoot.getFeed()) return true

    return this.getUserReferrerEdges(publicRoot).filter((e) => !this.isUserReferrerPinned(e)).length > 0
  }

  private getUserReferrerEdges(user: User | Vertex<GraphObject>) {
    const publicRoot = user instanceof User ? user.publicRoot : user
    const feed = publicRoot.getFeed()
    return <Array<Edge & { feed: Buffer }>>this.root.getEdges('.').filter((e) => e.view === REFERRER_VIEW && e.feed && e.feed.toString('hex') === feed)
  }

  private isUserReferrerPinned(edge: Edge & { feed: Buffer }) {
    const feed = edge.feed.toString('hex')
    const pinningPattern = new RegExp(feed + '#[1-9].*')
    return edge.restrictions && !!edge.restrictions.find(restrictionIsPinned)

    function restrictionIsPinned(restriction: Restriction) {
      return pinningPattern.test(restriction.rule) || (restriction.except && restrictionIsPinned(restriction.except))
    }
  }

  async getWriters() {
    return Promise.all((await this.getWriterUrls()).map((url) => this.getUserByUrl(url)))
  }

  async getWriterUrls() {
    const self = this
    const view = this.graph.factory.get(STATIC_VIEW)
    const states = await view
      .query(Generator.from([new QueryState(this.root, [], [], view)]))
      .out('.')
      .matches((v) => v.getContent()?.typeName === GraphObjectTypeNames.PRESHARED)
      .generator()
      .rawQueryStates(onError)

    const urls = states
      .filter((s) => !s.restrictsVersion((<Vertex<PreSharedGraphObject>>s.value).getFeed()))
      .map((s) => (<IVertex<PreSharedGraphObject>>s.value).getContent().owner)
      .filter((url) => url && url.trim().length > 0)

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
    const dir = await this.updateReferrer(edges)
    return dir
  }

  async rotateReferrerKeys() {
    let edges = (<ReferrerEdge[]>this.root.getEdges('.')).filter((e) => !!e.metadata.refKey)
    edges = await this.gcReferrers(edges)

    const latestVersion = Math.max(...edges.map((e) => readEdgeVersion(e)))
    let latestEdges = edges
    if (latestVersion > 0) {
      latestEdges = edges.filter((e) => readEdgeVersion(e) === latestVersion)
    }
    const newVersion = Buffer.alloc(4)
    newVersion.writeUInt32LE(latestVersion + 1, 0)

    const rotated = latestEdges.map((edge) => {
      const newKey = Primitives.generateEncryptionKey()
      return {
        ...edge,
        metadata: {
          ...edge.metadata,
          refKey: newKey,
          version: newVersion
        }
      }
    })

    this.root.setEdges(this.root.getEdges().concat(rotated))
  }

  private async gcReferrers(edges: ReferrerEdge[]): Promise<ReferrerEdge[]> {
    const mapped = new Map<String, ReferrerEdge[]>()
    edges.forEach((e) => {
      const feed = e.feed.toString('hex')
      const list = mapped.get(feed) || []
      list.push(e)
      list.sort((e1, e2) => readEdgeVersion(e1) - readEdgeVersion(e2))
      mapped.set(feed, list)
    })

    let remaining: ReferrerEdge[] = []
    for (const [writerFeed, writerEdges] of mapped.entries()) {
      let latest = 0
      for (const edge of writerEdges) {
        try {
          await this.tryGetReferrer(edge)
          latest = Math.max(latest, readEdgeVersion(edge))
        } catch (err) {
          debug(`Getting writer ${writerFeed} referrer edge at version ${readEdgeVersion(edge)} failed with error: ${(<Error>err).message}`)
        }
      }
      remaining = remaining.concat(writerEdges.filter((e) => readEdgeVersion(e) >= latest))
    }
    return remaining
  }

  async updateReferrer(edges?: ReferrerEdge[]): Promise<Vertex<Directory>> {
    const feed = await this.defaultFeed
    if (!edges) {
      edges = (<ReferrerEdge[]>this.root.getEdges('.')).filter((e) => e.metadata?.refKey && e.feed?.toString('hex') === feed)
    }

    const graphView = this.graph.factory.get(GRAPH_VIEW)
    const spaceView = this.graph.factory.get(SPACE_VIEW)
    const dirs = await Promise.all(
      await spaceView.get({ ref: this.root.getId(), feed: Buffer.from(this.root.getFeed(), 'hex'), label: '' }, new QueryState(undefined, [], [], graphView))
    )
    //const dirs = await Promise.all(await spaceView.out(new SpaceQueryState(this.root, [], [], graphView, this), '.'))
    const writeable = <Vertex<Directory>>dirs.find((v) => (<Vertex<GraphObject>>v.result).getFeed() === this.user.publicRoot.getFeed())?.result
    if (writeable) {
      const latest = latestEdge(edges)
      // TODO: do NOT update if edge is pinned!
      if (!this.graph.getKey(writeable).equals(latest.metadata.refKey)) {
        this.graph.registerVertexKey(writeable.getId(), writeable.getFeed(), latest.metadata.refKey)
        await this.graph.put(writeable)
      }
    } else {
      debug('tryGetWriteableRoot: empty referrer for feed ' + this.user.publicRoot.getFeed())
    }
    return writeable
  }

  async tryGetReferrer(edge: ReferrerEdge) {
    const view = this.graph.factory.get(REFERRER_VIEW)
    const state = new SpaceQueryState(this.root, [], [], this.graph.factory.get(GRAPH_VIEW), this)
    return await view.get(edge, state)
  }

  async createWriteableRoot() {
    const feed = await this.defaultFeed
    const edge = latestEdge(<ReferrerEdge[]>this.root.getEdges('.').filter((e) => e.feed?.toString('hex') === feed))
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

    const vertex = await this.getVertex(edge, state)
    if (vertex.getContent()?.typeName === GraphObjectTypeNames.SPACE) {
      let space = new CollaborationSpace(this.graph, <Vertex<SpaceGraphObject>>vertex, this.user)
      state = new SpaceQueryState(vertex, state.path, state.rules, this, space)
      // TODO: filter referrers to use latest available one (try catch)
      const resultingStates = await this.getWriters(<SpaceQueryState>state)
      return resultingStates.map(async (next) => {
        const res = await next
        return this.toResult(res.result, edge, res.state)
      })
    } else {
      return [Promise.resolve(this.toResult(vertex, edge, state))]
    }
  }

  private async getWriters(state: SpaceQueryState): Promise<QueryResult<GraphObject>> {
    const edges = state.space.root.getEdges('.')
    const ownerEdges = edges.filter((e) => !e.feed || e.feed?.toString('hex') === state.space.root.getFeed())
    const refEdges = <ReferrerEdge[]>edges.filter((e) => !!(<ReferrerEdge>e).metadata?.refKey)
    //const refResults = <QueryResult<GraphObject>[]> (await Promise.all(refEdges.map(e => state.space.tryGetReferrer(e).catch(onError)))).filter(res => !!res)
    let refResults: QueryResult<GraphObject>[] = []
    for (const e of refEdges) {
      const res = await state.space.tryGetReferrer(e).catch(onError)
      if (res) refResults.push(res)
    }
    const ownerResult = await Promise.all(
      ownerEdges.map((e) => this.get({ ...e, feed: e.feed || Buffer.from(state.space.root.getFeed(), 'hex'), view: e.view || GRAPH_VIEW }, state))
    )
    const results: QueryResult<GraphObject> = flatMap(ownerResult.concat(refResults))
    return results

    function onError(err: Error) {
      debug(`Getting writer edge failed with error: ${(<Error>err).message}`)
    }
  }
}

function readEdgeVersion(edge: ReferrerEdge) {
  return edge.metadata.version?.readUInt32LE(0) || 0
}

function flatMap<T>(arr: T[][]) {
  return arr.reduce((acc, x) => acc.concat(x), [])
}

function latestEdge(edges: ReferrerEdge[]) {
  const sorted = edges.slice().sort((e1, e2) => readEdgeVersion(e2) - readEdgeVersion(e1))
  return sorted[0]
}
