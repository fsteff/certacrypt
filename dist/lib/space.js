"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationSpaceView = exports.CollaborationSpace = exports.SpaceQueryState = exports.SPACE_VIEW = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const graphObjects_1 = require("./graphObjects");
const user_1 = require("./user");
const referrer_1 = require("./referrer");
const url_1 = require("./url");
exports.SPACE_VIEW = 'SpaceView';
class SpaceQueryState extends hyper_graphdb_1.QueryState {
    constructor(value, path, rules, space) {
        super(value, path, rules);
        this.space = space;
    }
    nextState(vertex, label, feed) {
        return new SpaceQueryState(vertex, this.path.concat([{ label, vertex, feed }]), this.rules, this.space);
    }
    addRestrictions(vertex, restrictions) {
        const newRules = new hyper_graphdb_1.QueryRule(vertex, restrictions);
        return new SpaceQueryState(this.value, this.path, this.rules.concat(newRules), this.space);
    }
    setSpace(space) {
        return new SpaceQueryState(this.value, this.path, this.rules, space);
    }
    getPathRelativeToSpace() {
        let path = this.path;
        while (path.length > 0 && !path[0].vertex.equals(this.space.root)) {
            path = path.slice(1);
        }
        return path.slice(1).map(p => encodeURIComponent(p.label)).join('/');
    }
}
exports.SpaceQueryState = SpaceQueryState;
class CollaborationSpace {
    constructor(graph, root, user) {
        this.graph = graph;
        this.root = root;
        this.user = user;
        this.defaultFeed = graph.core.getDefaultFeedId().then(feed => feed.toString('hex'));
    }
    static async CreateSpace(graph, user, parentVertex, childVertex, parentSpace) {
        if (parentSpace && parentSpace.root.getFeed() !== await parentSpace.defaultFeed) {
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
        const writeable = await this.getWriteableRoot();
        return this.graph.createEdgesToPath(path, writeable, leaf);
    }
    async createThombstoneAtPath(path) {
    }
    async addWriter(user, restrictions) {
        await user.referToPresharedVertex(this.root, '.', restrictions);
    }
    async getWriters() {
        const self = this;
        const writers = await this.graph.queryAtVertex(this.root)
            .out('.', this.graph.factory.get(hyper_graphdb_1.GRAPH_VIEW))
            .matches(v => { var _a; return ((_a = v.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.PRESHARED; })
            .generator()
            .values(onError)
            .map(v => v.getContent().owner)
            .filter(url => url && url.trim().length > 0)
            .map(url => this.getUserByUrl(url))
            .destruct();
        return [await this.getOwner()].concat(writers);
        function onError(err) {
            console.error(`getWriters: Failed to get Vertex for PreSharedGraphObject in Space ${self.root.getId()}@${self.root.getFeed()}: ${err}`);
        }
    }
    async getOwner() {
        return this.getUserByUrl(this.root.getContent().owner);
    }
    async getWriteableRoot() {
        const self = this;
        const feed = await this.defaultFeed;
        const referrerView = this.graph.factory.get(referrer_1.REFERRER_VIEW).filterUser(this.user.getPublicUrl());
        const writeable = await this.graph.queryAtVertex(this.root)
            .out('.', referrerView)
            //.matches(v => (<Vertex<GraphObject>>v).getFeed() === feed) // not needed when filtering for user(?)
            .generator()
            .destruct(onError);
        if (writeable.length === 0) {
            const edge = this.root.getEdges('.').filter(e => { var _a; return ((_a = e.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) === feed; })[0];
            if (!edge) {
                throw new Error('Insufficient permissions to write to space');
            }
            const created = await this.user.writeToPresharedVertex(edge);
            writeable.push(created);
        }
        return writeable[0];
        function onError(err) {
            console.error(`findWriteablePath: Failed to get Vertex in Space ${self.root.getId()}@${self.root.getFeed()}: ${err}`);
        }
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
    async out(state, label) {
        var _a;
        const vertex = state.value;
        if (((_a = vertex.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.SPACE) {
            let space = new CollaborationSpace(this.graph, vertex, this.user);
            state = new SpaceQueryState(state.value, state.path, state.rules, space);
        }
        const view = this.factory.get(hyper_graphdb_1.GRAPH_VIEW);
        const results = await view.query(hyper_graphdb_1.Generator.from([state])).out('.').out(label).states();
        return results.map(async (res) => this.toResult(res.value, { label: res.path[res.path.length - 1].label, ref: 0 }, state));
    }
    async get(feed, id, version, viewDesc, metadata) {
        feed = Buffer.isBuffer(feed) ? feed.toString('hex') : feed;
        if (viewDesc) {
            const view = this.getView(viewDesc);
            return view.get(feed, id, version, undefined, metadata)
                .catch(err => { throw new hyper_graphdb_1.Errors.VertexLoadingError(err, feed, id, version); });
        }
        const tr = await this.getTransaction(feed, version);
        const vertex = await this.db.getInTransaction(id, this.codec, tr, feed)
            .catch(err => { throw new hyper_graphdb_1.Errors.VertexLoadingError(err, feed, id, version, viewDesc); });
        // every space MUST have a root directory that's stored on the same feed as the space root
        const edge = vertex.getEdges().find(e => !e.feed || e.feed.toString('hex') === feed);
        if (!edge) {
            throw new Error('CollaborationSpace does not have a root directory');
        }
        const promise = this.db.getInTransaction(edge.ref, this.codec, tr, feed);
        promise.catch(err => { throw new hyper_graphdb_1.Errors.VertexLoadingError(err, feed, id, version, viewDesc); });
        return promise;
    }
}
exports.CollaborationSpaceView = CollaborationSpaceView;
//# sourceMappingURL=space.js.map