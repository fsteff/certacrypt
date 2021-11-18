"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualDriveShareVertex = exports.DriveShareView = exports.DRIVE_SHARE_VIEW = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const communication_1 = require("./communication");
const url_1 = require("./url");
exports.DRIVE_SHARE_VIEW = 'DriveShareView';
class DriveShareView extends hyper_graphdb_1.View {
    constructor(cacheDb, graph, socialRoot, contentEncoding, factory, transactions) {
        super(graph.core, contentEncoding, factory, transactions);
        this.cacheDb = cacheDb;
        this.graph = graph;
        this.socialRoot = socialRoot;
        this.viewName = exports.DRIVE_SHARE_VIEW;
    }
    async out(state, label) {
        return this.getView(hyper_graphdb_1.GRAPH_VIEW).out(state, label);
    }
    async get(feed, id, version, viewDesc, metadata) {
        feed = Buffer.isBuffer(feed) ? feed.toString('hex') : feed;
        if (viewDesc) {
            const view = this.getView(viewDesc);
            return view.get(feed, id, version, undefined, metadata);
        }
        const edges = await this.getShareEdges();
        const tr = await this.getTransaction(feed, version);
        const realVertex = await this.db.getInTransaction(id, this.codec, tr, feed);
        return new VirtualDriveShareVertex(edges.concat(realVertex.getEdges()), realVertex);
    }
    getShareEdges() {
        return this.getView(communication_1.COMM_VIEW)
            .query(hyper_graphdb_1.Generator.from([new hyper_graphdb_1.QueryState(this.socialRoot, [], [])]))
            .out(communication_1.COMM_PATHS.COMM_TO_RCV_SHARES)
            .generator()
            .values((err) => console.error('DriveShareView: failed to load share:' + err))
            .map((v) => v.getContent())
            .map((c) => this.uniqueEdge(c))
            .filter(async (e) => e !== null)
            .destruct();
    }
    uniqueEdge(share) {
        const userParsed = url_1.parseUrl(share.sharedBy);
        const userLabel = userParsed.id + '@' + userParsed.feed;
        const shareLabel = share.share.getId() + '@' + share.share.getFeed();
        const label = encodeURIComponent(userLabel + '/' + shareLabel);
        const edge = share.share.getEdges('share')[0];
        if (!edge)
            return null;
        return Object.assign(Object.assign({}, edge), { label });
    }
}
exports.DriveShareView = DriveShareView;
class VirtualDriveShareVertex {
    constructor(edges, realVertex) {
        this.edges = edges;
        this.realVertex = realVertex;
    }
    getContent() {
        return this.realVertex.getContent();
    }
    getEdges(label) {
        return this.edges.filter((e) => !label || label === e.label);
    }
    equals(other) {
        return this.realVertex.equals(other);
    }
    getVersion() {
        return this.realVertex.getVersion();
    }
    getFeed() {
        return this.realVertex.getFeed();
    }
    getId() {
        return this.realVertex.getId();
    }
    getWriteable() {
        return this.realVertex.getWriteable();
    }
    getMetadata() {
        this.realVertex.getMetadata();
    }
}
exports.VirtualDriveShareVertex = VirtualDriveShareVertex;
//# sourceMappingURL=driveshares.js.map