"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Inbox = exports.ENVELOPE_EDGE = exports.ENVELOPE_VIEW = void 0;
const certacrypt_crypto_1 = require("certacrypt-crypto");
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
            if (Buffer.isBuffer(key))
                this.crypto.registerKey(key, { index: edge.ref, feed: edge.feed.toString('hex'), type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
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
        const pubkey = receipient.getPublicKey();
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
    }
}
exports.Inbox = Inbox;
//# sourceMappingURL=inbox.js.map