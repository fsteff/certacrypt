"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferrerView = exports.REFERRER_VIEW = void 0;
const certacrypt_crypto_1 = require("certacrypt-crypto");
const hyper_graphdb_1 = require("hyper-graphdb");
const debug_1 = require("./debug");
exports.REFERRER_VIEW = 'ReferrerView';
class ReferrerView extends hyper_graphdb_1.View {
    constructor(db, contentEncoding, factory, transactions) {
        super(db, contentEncoding, factory, transactions);
        this.viewName = exports.REFERRER_VIEW;
        this.crypto = db.crypto;
    }
    async out(state, label) {
        const vertex = state.value;
        if (typeof vertex.getId !== 'function' || typeof vertex.getFeed !== 'function' || !vertex.getFeed()) {
            throw new Error('Vertex is not a a physical one, cannot use it for a ReferrerView');
        }
        const edges = vertex.getEdges(label);
        const vertices = [];
        for (const edge of edges) {
            const feed = edge.feed || Buffer.from(vertex.getFeed(), 'hex');
            const meta = edge.metadata;
            if (meta.refKey && meta.refLabel) {
                try {
                    const result = await this.get(Object.assign(Object.assign({}, edge), { feed, metadata: meta }), state);
                    for (const res of await result) {
                        vertices.push(res);
                    }
                }
                catch (err) {
                    // referred might not yet exist
                    debug_1.debug(err);
                }
            }
        }
        return vertices;
    }
    // within a query getting the PSV actually returns the one on the referred edge
    async get(edge, state) {
        var _a;
        const feed = edge.feed.toString('hex');
        if (!edge.metadata || !Buffer.isBuffer(edge.metadata.refKey) || !Buffer.isBuffer(edge.metadata.refLabel) || edge.metadata.refLabel.length === 0) {
            throw new Error('ReferrerView.get requires metadata.refKey and .refLabel to be set');
        }
        const tr = await this.getTransaction(feed);
        const vertex = await this.db.getInTransaction(edge.ref, this.codec, tr, feed);
        const edges = vertex.getEdges(edge.metadata.refLabel.toString('base64'));
        if (edges.length === 0) {
            debug_1.debug('ReferrerView: empty pre-shared vertex');
            return [];
        }
        const ref = {
            feed: ((_a = edges[0].feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) || feed,
            version: edges[0].version,
            view: edges[0].view || hyper_graphdb_1.GRAPH_VIEW,
            id: edges[0].ref,
            label: edge.metadata.refLabel.toString('base64')
        };
        this.crypto.registerKey(edge.metadata.refKey, { feed: ref.feed, index: ref.id, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
        const view = this.getView(ref.view);
        const nextStates = await view
            .query(hyper_graphdb_1.Generator.from([state.mergeStates(vertex, state.path, state.rules, state.view)]))
            .out(ref.label)
            .states();
        if (nextStates.length === 0)
            throw new Error('vertex has no share edge, cannot use ShareView');
        return nextStates.map(async (next) => {
            const mergedState = next.mergeStates(next.value, state.path.concat(next.path.slice(1)), state.rules, next.view);
            return this.toResult(next.value, edge, mergedState);
        });
    }
}
exports.ReferrerView = ReferrerView;
//# sourceMappingURL=referrer.js.map