"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertaCryptGraph = exports.NoAccessError = exports.SHARE_GRAPHOBJECT = exports.SHARE_VIEW = exports.ShareView = exports.CryptoCore = exports.ShareGraphObject = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const certacrypt_crypto_1 = require("certacrypt-crypto");
const CryptoCore_1 = require("./lib/CryptoCore");
Object.defineProperty(exports, "CryptoCore", { enumerable: true, get: function () { return CryptoCore_1.CryptoCore; } });
const Errors_1 = require("./lib/Errors");
Object.defineProperty(exports, "NoAccessError", { enumerable: true, get: function () { return Errors_1.NoAccessError; } });
const Share_1 = require("./lib/Share");
Object.defineProperty(exports, "ShareGraphObject", { enumerable: true, get: function () { return Share_1.ShareGraphObject; } });
Object.defineProperty(exports, "ShareView", { enumerable: true, get: function () { return Share_1.ShareView; } });
Object.defineProperty(exports, "SHARE_VIEW", { enumerable: true, get: function () { return Share_1.SHARE_VIEW; } });
Object.defineProperty(exports, "SHARE_GRAPHOBJECT", { enumerable: true, get: function () { return Share_1.SHARE_GRAPHOBJECT; } });
class CertaCryptGraph extends hyper_graphdb_1.HyperGraphDB {
    constructor(corestore, key, crypto) {
        super(corestore, key, undefined, new CryptoCore_1.CryptoCore(corestore, key, crypto));
        this.codec.registerImpl(serialized => new Share_1.ShareGraphObject(serialized));
        this.factory.register(Share_1.SHARE_VIEW, (db, codec, tr) => new Share_1.ShareView(db, codec, this.factory, tr));
    }
    async put(vertex, feed) {
        const vertices = Array.isArray(vertex) ? vertex : [vertex];
        for (const elem of vertices) {
            await this.core.setEdgeKeys(elem);
        }
        return super.put(vertex, feed);
    }
    async get(id, feed, key) {
        if (key) {
            if (!feed)
                feed = await this.core.getDefaultFeedId();
            feed = Buffer.isBuffer(feed) ? feed.toString('hex') : feed;
            this.crypto.registerKey(key, { feed, index: id, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
        }
        const vertex = await super.get(id, feed)
            .catch(err => Errors_1.NoAccessError.detectAndThrow(id, err));
        this.core.registerEdges(vertex);
        return vertex;
    }
    getKey(vertex) {
        if (vertex.getId() < 0 || !vertex.getFeed())
            throw new Error('vertex has to be persisted to get its key');
        return this.crypto.getKey(vertex.getFeed(), vertex.getId());
    }
    get crypto() {
        return this.core.crypto;
    }
}
exports.CertaCryptGraph = CertaCryptGraph;
//# sourceMappingURL=index.js.map