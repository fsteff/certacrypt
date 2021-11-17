"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferrerView = exports.REFERRER_VIEW = void 0;
const certacrypt_crypto_1 = require("certacrypt-crypto");
const hyper_graphdb_1 = require("hyper-graphdb");
const graphObjects_1 = require("./graphObjects");
exports.REFERRER_VIEW = 'ReferrerView';
class ReferrerView extends hyper_graphdb_1.View {
    constructor(db, contentEncoding, factory, transactions) {
        super(db, contentEncoding, factory, transactions);
        this.viewName = exports.REFERRER_VIEW;
        this.crypto = db.crypto;
    }
    async out(state, label) {
        var _a;
        const vertex = state.value;
        if (!(vertex.getContent() instanceof graphObjects_1.PreSharedGraphObject)) {
            throw new Error('Vertex is not a a physical one, cannot use it for a PreSharedVertexView');
        }
        const edges = vertex.getEdges(label);
        const vertices = [];
        for (const edge of edges) {
            const feed = ((_a = edge.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) || vertex.getFeed();
            const meta = edge.metadata;
            if (meta.refKey && meta.refLabel) {
                vertices.push(this.get(feed, edge.ref, undefined, edge.view, meta).then(v => this.toResult(v, edge, state)));
            }
        }
        return vertices;
    }
    // within a query getting the PSV actually returns the one on the referred edge
    async get(feed, id, version, _, metadata) {
        var _a;
        feed = Buffer.isBuffer(feed) ? feed.toString('hex') : feed;
        if (!metadata || !Buffer.isBuffer(metadata.refKey) || !Buffer.isBuffer(metadata.refLabel) || metadata.refLabel.length === 0) {
            throw new Error('PreSharedVertexView.get requires metadata.refKey and .refLabel to be set');
        }
        const tr = await this.getTransaction(feed, version);
        const vertex = await this.db.getInTransaction(id, this.codec, tr, feed);
        const edges = vertex.getEdges(metadata.refLabel.toString('base64'));
        if (edges.length === 0)
            return Promise.reject('empty pre-shared vertex');
        const ref = {
            feed: ((_a = edges[0].feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) || feed,
            version: edges[0].version,
            view: edges[0].view || hyper_graphdb_1.GRAPH_VIEW,
            id: edges[0].ref,
            label: metadata.refLabel.toString('base64')
        };
        this.crypto.registerKey(metadata.refKey, { feed: ref.feed, index: ref.id, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
        const view = this.getView(ref.view);
        const next = await view.query(hyper_graphdb_1.Generator.from([new hyper_graphdb_1.QueryState(vertex, [], [])])).out(ref.label).vertices();
        if (next.length === 0)
            throw new Error('vertex has no share edge, cannot use ShareView');
        return next[0];
    }
}
exports.ReferrerView = ReferrerView;
//# sourceMappingURL=referrer.js.map