"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Inbox = exports.ENVELOPE_EDGE = exports.ENVELOPE_VIEW = void 0;
const certacrypt_crypto_1 = require("@certacrypt/certacrypt-crypto");
exports.ENVELOPE_VIEW = 'EnvelopeView';
exports.ENVELOPE_EDGE = 'mail';
class Inbox {
    constructor(crypto, graph, inbox) {
        this.crypto = crypto;
        this.graph = graph;
        this.inbox = inbox;
    }
    async checkEnvelopes(onlyAfter) {
        if (!onlyAfter)
            onlyAfter = 0;
        return Promise.all(this.inbox
            .getEdges(exports.ENVELOPE_EDGE)
            .filter((edge) => edge.version > onlyAfter)
            .filter((edge) => {
            const box = edge.metadata.envelope;
            const key = this.crypto.tryOpenEnvelope(box);
            if (Buffer.isBuffer(key)) {
                // console.log('registering key for envelope ' + edge.ref + '@' + edge.feed.toString('hex') + ': ' + key.toString('hex').substr(0, 2) + '...')
                this.crypto.registerKey(key, { index: edge.ref, feed: edge.feed.toString('hex'), type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
            }
            return Buffer.isBuffer(key);
        })
            .map(async (edge) => {
            try {
                return await this.graph.get(edge.ref, edge.feed || this.inbox.getFeed());
            }
            catch (err) {
                console.error(`failed to fetch referred vertex from envelope: ${edge.ref}@${edge.feed || this.inbox.getFeed()} `);
            }
        })
            .filter(async (vertex) => !!(await vertex)));
    }
    async postEnvelope(msg, receipient) {
        const pubkey = await receipient.getPublicKey();
        const secret = this.graph.getKey(msg);
        const box = this.crypto.sealEnvelope(pubkey, secret);
        const edge = {
            ref: msg.getId(),
            label: exports.ENVELOPE_EDGE,
            version: msg.getVersion(),
            feed: Buffer.from(msg.getFeed(), 'hex'),
            metadata: {
                envelope: box
            }
        };
        this.inbox.addEdge(edge);
        await this.graph.put(this.inbox);
        // safety check to make sure certacrypt-graph doesn't ever inject the key
        if (this.inbox.getEdges().find((e) => { var _a; return !!((_a = e.metadata) === null || _a === void 0 ? void 0 : _a['key']); }))
            throw new Error('envelope edge has key');
    }
    getVersion() {
        return this.inbox.getVersion();
    }
}
exports.Inbox = Inbox;
//# sourceMappingURL=inbox.js.map