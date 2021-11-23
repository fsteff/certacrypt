"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationSpaceView = exports.CollaborationSpace = exports.SpaceQueryState = exports.SPACE_VIEW = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const graphObjects_1 = require("./graphObjects");
const user_1 = require("./user");
const referrer_1 = require("./referrer");
const url_1 = require("./url");
const debug_1 = require("./debug");
exports.SPACE_VIEW = 'SpaceView';
class SpaceQueryState extends hyper_graphdb_1.QueryState {
    constructor(value, path, rules, view, space) {
        super(value, path, rules, view);
        this.space = space;
    }
    nextState(vertex, label, feed, view) {
        return new SpaceQueryState(vertex, this.path.concat([{ label, vertex, feed }]), this.rules, view || this.view, this.space);
    }
    addRestrictions(vertex, restrictions) {
        const newRules = new hyper_graphdb_1.QueryRule(vertex, restrictions);
        return new SpaceQueryState(this.value, this.path, this.rules.concat(newRules), this.view, this.space);
    }
    mergeStates(value, path, rules, view) {
        return new SpaceQueryState(value || this.value, path || this.path, rules || this.rules, view || this.view, this.space);
    }
    setSpace(space) {
        return new SpaceQueryState(this.value, this.path, this.rules, this.view, space);
    }
}
exports.SpaceQueryState = SpaceQueryState;
class CollaborationSpace {
    constructor(graph, root, user) {
        this.graph = graph;
        this.root = root;
        this.user = user;
        this.defaultFeed = graph.core.getDefaultFeedId().then((feed) => feed.toString('hex'));
    }
    static async CreateSpace(graph, user, parentVertex, childVertex, parentSpace) {
        if (parentSpace && parentSpace.root.getFeed() !== (await parentSpace.defaultFeed)) {
            throw new Error('Insufficient permissions to create sub-space');
        }
        const root = graph.create();
        const spaceObj = new graphObjects_1.SpaceGraphObject();
        spaceObj.owner = user.getPublicUrl();
        root.setContent(spaceObj);
        await graph.put(root);
        root.addEdgeTo(childVertex, '.');
        await graph.put(root);
        parentVertex.replaceEdgeTo(childVertex, (edge) => {
            return Object.assign(Object.assign({}, edge), { ref: root.getId(), view: exports.SPACE_VIEW });
        });
        await graph.put(parentVertex);
        return new CollaborationSpace(graph, root, user);
    }
    async createEdgesToPath(path, leaf) {
        let writeable = await this.tryGetWriteableRoot();
        if (!writeable) {
            writeable = await this.createWriteableRoot();
        }
        return this.graph.createEdgesToPath(path, writeable, leaf);
    }
    async createThombstoneAtPath(path) { }
    async addWriter(user, restrictions) {
        await user.referToPresharedVertex(this.root, '.', restrictions);
    }
    async getWriters() {
        const self = this;
        const writers = await this.graph
            .queryAtVertex(this.root)
            .out('.', this.graph.factory.get(hyper_graphdb_1.GRAPH_VIEW))
            .matches((v) => { var _a; return ((_a = v.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.PRESHARED; })
            .generator()
            .values(onError)
            .map((v) => v.getContent().owner)
            .filter((url) => url && url.trim().length > 0)
            .map((url) => this.getUserByUrl(url))
            .destruct();
        return [await this.getOwner()].concat(writers);
        function onError(err) {
            console.error(`getWriters: Failed to get Vertex for PreSharedGraphObject in Space ${self.root.getId()}@${self.root.getFeed()}: ${err}`);
        }
    }
    async getOwner() {
        return this.getUserByUrl(this.root.getContent().owner);
    }
    async tryGetWriteableRoot() {
        const feed = await this.defaultFeed;
        if (feed === this.root.getFeed()) {
            const graphView = this.graph.factory.get(hyper_graphdb_1.GRAPH_VIEW);
            const edges = this.root.getEdges('.').filter((e) => { var _a; return !e.feed || ((_a = e.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) === feed; });
            if (edges.length === 0) {
                return undefined;
            }
            return await hyper_graphdb_1.ValueGenerator.from(await graphView.get(Object.assign(Object.assign({}, edges[0]), { feed: Buffer.from(feed, 'hex') }), new hyper_graphdb_1.QueryState(this.root, [], [], this.graph.factory.get(exports.SPACE_VIEW))))
                .map(async (r) => (await r).result)
                .first();
        }
        const referrerView = this.graph.factory.get(referrer_1.REFERRER_VIEW);
        const edges = this.root.getEdges('.').filter((e) => { var _a; return e.metadata.refKey && ((_a = e.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) === feed; });
        if (edges.length === 0) {
            return undefined;
        }
        const dirs = await referrerView.get(edges[0], new hyper_graphdb_1.QueryState(this.root, [], [], this.graph.factory.get(exports.SPACE_VIEW)));
        if (dirs.length === 0) {
            debug_1.debug('tryGetWriteableRoot: empty referrer for feed ' + feed);
            return undefined;
        }
        return (await dirs[0]).result;
    }
    async createWriteableRoot() {
        const feed = await this.defaultFeed;
        const edge = this.root.getEdges('.').filter((e) => { var _a; return ((_a = e.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) === feed; })[0];
        if (!edge) {
            throw new Error('Insufficient permissions to write to space');
        }
        const created = await this.user.writeToPresharedVertex(edge);
        debug_1.debug('createWriteableRoot: created for space ' + this.root.getId() + '@' + this.root.getFeed() + ' and feed ' + feed);
        return created;
    }
    async getUserByUrl(url) {
        const { feed, id, key } = url_1.parseUrl(url);
        const root = await this.graph.get(id, feed, key);
        return new user_1.User(root, this.graph);
    }
}
exports.CollaborationSpace = CollaborationSpace;
class CollaborationSpaceView extends hyper_graphdb_1.View {
    constructor(user, graph, contentEncoding, factory, transactions) {
        super(graph.core, contentEncoding, factory, transactions);
        this.user = user;
        this.graph = graph;
        this.viewName = exports.SPACE_VIEW;
    }
    getView(name) {
        if (!name)
            return this;
        // do not fall back to GRAPH_VIEW as default view
        else
            return this.factory.get(name, this.transactions);
    }
    /*
      public async out(state: QueryState<GraphObject>, label?: string): Promise<QueryResult<GraphObject>> {
          const vertex = <Vertex<GraphObject>> state.value
          if(vertex.getContent()?.typeName === GraphObjectTypeNames.SPACE) {
              let space = new CollaborationSpace(this.graph, <Vertex<SpaceGraphObject>>vertex, this.user)
              state = new SpaceQueryState(state.value, state.path, state.rules, this, space)
  
              const view = this.factory.get(GRAPH_VIEW)
              const results = await view.query(Generator.from([state])).out('.').out(label).states()
              return results.map(async res => this.toResult(res.value, {label: res.path[res.path.length-1].label, ref: 0}, state))
          } else {
              if(typeof vertex.getId !== 'function' || typeof vertex.getFeed !== 'function' || !vertex.getFeed()) {
                  throw new Error('GraphView.out does only accept persisted Vertex instances as input')
              }
              const edges = vertex.getEdges(label)
              const vertices: QueryResult<GraphObject> = []
              for(const edge of edges) {
                  const feed =  edge.feed || Buffer.from(<string>vertex.getFeed(), 'hex')
                  const promise = this.get({...edge, feed}, state)
                  promise.catch(err => {throw new Errors.EdgeTraversingError({id: vertex.getId(), feed: <string>vertex.getFeed()}, edge, new Error('key is ' + edge.metadata?.['key']?.toString('hex').substr(0,2) + '...'))})
                  for(const res of await promise) {
                      vertices.push(res)
                  }
              }
              return vertices
          }
      }*/
    async get(edge, state) {
        var _a;
        const feed = edge.feed.toString('hex');
        if (edge.view) {
            const view = this.getView(edge.view);
            return view.get(Object.assign(Object.assign({}, edge), { view: undefined }), state).catch((err) => {
                throw new hyper_graphdb_1.Errors.VertexLoadingError(err, feed, edge.ref, edge.version);
            });
        }
        const tr = await this.getTransaction(feed);
        const vertex = await this.db.getInTransaction(edge.ref, this.codec, tr, feed).catch((err) => {
            throw new hyper_graphdb_1.Errors.VertexLoadingError(err, feed, edge.ref, edge.version, edge.view);
        });
        if (((_a = vertex.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.SPACE) {
            let space = new CollaborationSpace(this.graph, vertex, this.user);
            state = new SpaceQueryState(vertex, state.path, state.rules, this, space);
            const resultingStates = await this.out(state, '.');
            return resultingStates.map(async (next) => {
                const res = await next;
                return this.toResult(res.result, edge, state);
            });
        }
        else {
            return [Promise.resolve(this.toResult(vertex, edge, state))];
        }
    }
}
exports.CollaborationSpaceView = CollaborationSpaceView;
//# sourceMappingURL=space.js.map