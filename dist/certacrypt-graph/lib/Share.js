"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareView = exports.SHARE_VIEW = exports.ShareGraphObject = exports.SHARE_GRAPHOBJECT = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
exports.SHARE_GRAPHOBJECT = 'Share';
class ShareGraphObject extends hyper_graphdb_1.GraphObject {
    constructor(serialized) {
        super();
        this.typeName = exports.SHARE_GRAPHOBJECT;
        if (serialized) {
            const json = JSON.parse(serialized.toString());
            if (json.version)
                this.version = json.version;
        }
    }
    serialize() {
        let json = {};
        if (this.version)
            json.version = this.version;
        if (this.info)
            json.info = this.info;
        return Buffer.from(JSON.stringify(json));
    }
}
exports.ShareGraphObject = ShareGraphObject;
exports.SHARE_VIEW = 'ShareView';
class ShareView extends hyper_graphdb_1.View {
    constructor() {
        super(...arguments);
        this.viewName = exports.SHARE_VIEW;
    }
    async out(vertex, label) {
        var _a, _b;
        if (!(vertex.getContent() instanceof ShareGraphObject)) {
            throw new Error('Vertex is not a a physical one, cannot use it for a ShareView');
        }
        const edges = vertex.getEdges(label);
        const vertices = new Array();
        for (const edge of edges) {
            const version = (_a = vertex.getContent()) === null || _a === void 0 ? void 0 : _a.version; // optional, might be undefined - TODO: test pinning
            const feed = ((_b = edge.feed) === null || _b === void 0 ? void 0 : _b.toString('hex')) || vertex.getFeed();
            vertices.push(this.get(feed, edge.ref, version, edge.view));
        }
        return hyper_graphdb_1.Generator.from(vertices);
    }
    // within a query getting the share vertex actually returns the one on the 'share' edge
    async get(feed, id, version, viewDesc) {
        feed = Buffer.isBuffer(feed) ? feed.toString('hex') : feed;
        viewDesc = viewDesc || hyper_graphdb_1.GRAPH_VIEW;
        const tr = await this.getTransaction(feed, version);
        const vertex = await this.db.getInTransaction(id, this.codec, tr, feed);
        const view = this.getView(viewDesc);
        const next = await (await view.out(vertex, 'share')).destruct();
        if (next.length === 0)
            throw new Error('vertex has no share edge, cannot use ShareView');
        return next[0];
    }
}
exports.ShareView = ShareView;
//# sourceMappingURL=Share.js.map