"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Shares = exports.SHARE_TYPE_USER = exports.SHARE_TYPE_URL = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const certacrypt_graph_1 = require("certacrypt-graph");
const space_1 = require("./space");
const graphObjects_1 = require("./graphObjects");
exports.SHARE_TYPE_URL = 'url';
exports.SHARE_TYPE_USER = 'user';
class Shares {
    constructor(graph, user, sharesRoot) {
        this.graph = graph;
        this.user = user;
        const id = sharesRoot.getId();
        const feed = sharesRoot.getFeed();
        this.getSharesRoot = () => graph.get(id, feed);
    }
    async createShare(vertex, shareByUrl = false) {
        var _a;
        const root = await this.getSharesRoot();
        if (shareByUrl) {
            const shares = await this.findSharesTo(vertex, true);
            if (shares.length > 0) {
                return shares[0];
            }
        }
        let view = hyper_graphdb_1.GRAPH_VIEW;
        const label = shareByUrl ? exports.SHARE_TYPE_URL : exports.SHARE_TYPE_USER;
        const info = shareByUrl ? 'share by URL' : 'share with user';
        const owner = this.user.getPublicUrl();
        if (((_a = vertex.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.SPACE) {
            view = space_1.SPACE_VIEW;
        }
        const shareVertex = await this.graph.createShare(vertex, { info, owner, view });
        root.addEdgeTo(shareVertex, label, { view: certacrypt_graph_1.SHARE_VIEW });
        await this.graph.put(root);
        return shareVertex;
    }
    async findSharesTo(vertex, shareByUrl = false) {
        const root = await this.getSharesRoot();
        const view = this.graph.factory.get(hyper_graphdb_1.STATIC_VIEW);
        const label = shareByUrl ? exports.SHARE_TYPE_URL : undefined;
        const matching = await view
            .query(hyper_graphdb_1.Generator.from([new hyper_graphdb_1.QueryState(root, [], [], view)]))
            .out(label, view)
            .generator()
            .filter((share) => { var _a; return !((_a = share.getContent()) === null || _a === void 0 ? void 0 : _a.revoked); })
            .filter(async (share) => {
            const target = await view
                .query(hyper_graphdb_1.Generator.from([new hyper_graphdb_1.QueryState(share, [], [], view)]))
                .out('share')
                .matches((v) => (Array.isArray(vertex) ? vertex.findIndex((other) => v.equals(other)) >= 0 : v.equals(vertex)))
                .generator()
                .destruct();
            return target.length > 0;
        })
            .destruct();
        return matching;
    }
    async getAllShares(includeRevoked = false) {
        const root = await this.getSharesRoot();
        const view = this.graph.factory.get(hyper_graphdb_1.STATIC_VIEW);
        const shares = await view
            .query(hyper_graphdb_1.Generator.from([new hyper_graphdb_1.QueryState(root, [], [], view)]))
            .out(undefined, view)
            .vertices();
        if (!includeRevoked) {
            return shares.filter((share) => { var _a; return !((_a = share.getContent()) === null || _a === void 0 ? void 0 : _a.revoked); });
        }
        else {
            return shares;
        }
    }
}
exports.Shares = Shares;
//# sourceMappingURL=shares.js.map