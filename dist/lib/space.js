"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaborationSpaceView = exports.CollaborationSpace = exports.SpaceQueryState = exports.SPACE_VIEW = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const graphObjects_1 = require("./graphObjects");
const user_1 = require("./user");
const referrer_1 = require("./referrer");
const url_1 = require("./url");
const debug_1 = require("./debug");
const certacrypt_crypto_1 = require("certacrypt-crypto");
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
    async addWriter(user, restrictions) {
        if (this.user.publicRoot.getFeed() !== this.root.getFeed()) {
            throw new Error('insufficient permissions, user is not the owner of the space');
        }
        if (this.userHasWriteAccess(user)) {
            throw new Error('user already has write access to space');
        }
        restrictions = Array.isArray(restrictions)
            ? restrictions
            : [{ rule: user.publicRoot.getFeed() + '/**/*', except: { rule: user.publicRoot.getFeed() + '/.' } }];
        await user.referToPresharedVertex(this.root, '.', restrictions);
    }
    userHasWriteAccess(user) {
        const publicRoot = (user === null || user === void 0 ? void 0 : user.publicRoot) || this.user.publicRoot;
        if (this.root.getFeed() === publicRoot.getFeed())
            return true;
        return this.root
            .getEdges('.')
            .filter((e) => e.view === referrer_1.REFERRER_VIEW && e.feed)
            .map((e) => e.feed.toString('hex'))
            .includes(publicRoot.getFeed());
    }
    async getWriters() {
        return Promise.all((await this.getWriterUrls()).map((url) => this.getUserByUrl(url)));
    }
    async getWriterUrls() {
        const self = this;
        const view = this.graph.factory.get(hyper_graphdb_1.STATIC_VIEW);
        const urls = await view
            .query(hyper_graphdb_1.Generator.from([new hyper_graphdb_1.QueryState(this.root, [], [], view)]))
            .out('.')
            .matches((v) => { var _a; return ((_a = v.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.PRESHARED; })
            .generator()
            .values(onError)
            .map((v) => v.getContent().owner)
            .filter((url) => url && url.trim().length > 0)
            .destruct();
        return [this.getOwnerUrl()].concat(urls);
        function onError(err) {
            console.error(`getWriterUrls: Failed to get Vertex for PreSharedGraphObject in Space ${self.root.getId()}@${self.root.getFeed()}: ${err}`);
        }
    }
    async getOwner() {
        return this.getUserByUrl(this.getOwnerUrl());
    }
    getOwnerUrl() {
        var _a;
        return (_a = this.root.getContent()) === null || _a === void 0 ? void 0 : _a.owner;
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
    async rotateReferrerKeys() {
        let edges = this.root.getEdges('.').filter((e) => !!e.metadata.refKey);
        edges = await this.gcReferrers(edges);
        const latestVersion = Math.max(...edges.map(e => readEdgeVersion(e)));
        let latestEdges = edges;
        if (latestVersion > 0) {
            latestEdges = edges.filter(e => readEdgeVersion(e) === latestVersion);
        }
        const newVersion = Buffer.alloc(4);
        newVersion.writeUInt32LE(latestVersion + 1);
        const rotated = latestEdges.map(edge => {
            const newKey = certacrypt_crypto_1.Primitives.generateEncryptionKey();
            return Object.assign(Object.assign({}, edge), { metadata: Object.assign(Object.assign({}, edge.metadata), { refKey: newKey, version: newVersion }) });
        });
        this.root.setEdges(this.root.getEdges().concat(rotated));
    }
    async gcReferrers(edges) {
        const mapped = new Map();
        edges.forEach(e => {
            const feed = e.feed.toString('hex');
            const list = mapped.get(feed) || [];
            list.push(e);
            list.sort((e1, e2) => readEdgeVersion(e1) - readEdgeVersion(e2));
        });
        let remaining = [];
        for (const [writerFeed, writerEdges] of mapped.entries()) {
            let latest = 0;
            for (const edge of writerEdges) {
                try {
                    await this.tryGetReferrer(edge);
                    latest = Math.max(latest, readEdgeVersion(edge));
                }
                catch (err) {
                    debug_1.debug(`Getting writer ${writerFeed} referrer edge at version ${readEdgeVersion(edge)} failed with error: ${err.message}`);
                }
            }
            remaining = remaining.concat(writerEdges.filter(e => readEdgeVersion(e) >= latest));
        }
        return remaining;
    }
    async tryGetReferrer(edge) {
        const view = this.graph.factory.get(referrer_1.REFERRER_VIEW);
        const state = new SpaceQueryState(this.root, [], [], this.graph.factory.get(hyper_graphdb_1.GRAPH_VIEW), this);
        return await view.get(edge, state);
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
            // TODO: filter referrers to use latest available one (try catch)
            return await this.getWriters(state);
            /*
            const resultingStates = await this.out(state, '.')
            return resultingStates.map(async (next) => {
              const res = await next
              return this.toResult(res.result, edge, state)
            })
            */
        }
        else {
            return [Promise.resolve(this.toResult(vertex, edge, state))];
        }
    }
    async getWriters(state) {
        const edges = state.space.root.getEdges('.');
        const ownerEdges = edges.filter(e => { var _a; return !e.feed || ((_a = e.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) === state.space.root.getFeed(); });
        const refEdges = edges.filter(e => { var _a; return !!((_a = e.metadata) === null || _a === void 0 ? void 0 : _a.refKey); });
        const refResults = (await Promise.all(refEdges.map(e => state.space.tryGetReferrer(e).catch(onError)))).filter(res => !!res);
        const ownerResult = (await Promise.all(ownerEdges.map(e => this.get(Object.assign(Object.assign({}, e), { feed: e.feed || Buffer.from(state.space.root.getFeed(), 'hex'), view: e.view || hyper_graphdb_1.GRAPH_VIEW }), state))));
        const results = flatMap(ownerResult.concat(refResults));
        return results;
        function onError(err) {
            debug_1.debug(`Getting writer edge failed with error: ${err.message}`);
        }
    }
}
exports.CollaborationSpaceView = CollaborationSpaceView;
function readEdgeVersion(edge) {
    var _a;
    return ((_a = edge.metadata.version) === null || _a === void 0 ? void 0 : _a.readUInt32LE()) || 0;
}
function flatMap(arr) {
    return arr.reduce((acc, x) => acc.concat(x), []);
}
//# sourceMappingURL=space.js.map