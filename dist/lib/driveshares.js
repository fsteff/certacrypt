"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualDriveShareVertex = exports.DriveShareView = exports.DRIVE_SHARE_VIEW = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const certacrypt_graph_1 = require("certacrypt-graph");
const communication_1 = require("./communication");
const url_1 = require("./url");
const __1 = require("..");
exports.DRIVE_SHARE_VIEW = 'DriveShareView';
class DriveShareView extends hyper_graphdb_1.View {
    constructor(cacheDb, graph, socialRoot, contentEncoding, factory, transactions) {
        super(graph.core, contentEncoding, factory, transactions);
        this.cacheDb = cacheDb;
        this.graph = graph;
        this.socialRoot = socialRoot;
        this.viewName = exports.DRIVE_SHARE_VIEW;
    }
    async get(edge, state) {
        const feed = edge.feed.toString('hex');
        const shareEdges = await this.getShareEdges(edge, state);
        const edges = shareEdges.map((s) => s.edge);
        const meta = shareEdges.map((s) => s.share);
        const tr = await this.getTransaction(feed);
        const realVertex = await this.db.getInTransaction(edge.ref, this.codec, tr, feed);
        return [Promise.resolve(this.toResult(new VirtualDriveShareVertex(edges.concat(realVertex.getEdges()), realVertex, meta), edge, state))];
    }
    async getShareEdges(prevEdge, state) {
        const path = [prevEdge.label].concat(state.path.map((p) => p.label)).join('/');
        const view = this.getView(communication_1.COMM_VIEW);
        const shares = await this.query(hyper_graphdb_1.Generator.from([state.mergeStates(this.socialRoot)]))
            .out(communication_1.COMM_PATHS.COMM_TO_RCV_SHARES, view)
            .generator()
            .values((err) => console.error('DriveShareView: failed to load share:' + err))
            .filter((v) => !!v.getContent())
            .destruct();
        const shareEdges = shares
            .map((v) => v.getContent())
            .map((c) => {
            const edge = this.uniqueEdge(c);
            return {
                share: {
                    share: __1.createUrl(c.share, this.graph.getKey(c.share), undefined, __1.URL_TYPES.SHARE, c.name),
                    owner: c.owner,
                    name: c.name,
                    path: '/' + path + '/' + edge.label,
                    label: edge.label
                },
                edge
            };
        });
        return shareEdges;
    }
    uniqueEdge(share) {
        const userParsed = url_1.parseUrl(share.sharedBy);
        const userLabel = userParsed.id + '@' + userParsed.feed;
        const shareLabel = share.share.getId() + '@' + share.share.getFeed();
        return {
            ref: share.share.getId(),
            feed: Buffer.from(share.share.getFeed(), 'hex'),
            label: encodeURIComponent(userLabel + '/' + shareLabel),
            metadata: { key: this.graph.getKey(share.share) },
            view: certacrypt_graph_1.SHARE_VIEW
        };
    }
}
exports.DriveShareView = DriveShareView;
class VirtualDriveShareVertex {
    constructor(edges, realVertex, meta) {
        this.edges = edges;
        this.realVertex = realVertex;
        this.meta = meta;
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
    getShareMetaData() {
        return this.meta;
    }
}
exports.VirtualDriveShareVertex = VirtualDriveShareVertex;
//# sourceMappingURL=driveshares.js.map