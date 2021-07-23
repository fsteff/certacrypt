"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoCore = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const certacrypt_crypto_1 = require("certacrypt-crypto");
const hyperobjects_1 = require("hyperobjects");
const Errors_1 = require("./Errors");
const buffer_crc32_1 = __importDefault(require("buffer-crc32"));
class CryptoCore extends hyper_graphdb_1.Core {
    constructor(corestore, key, crypto) {
        super(corestore, key);
        this.crypto = crypto || new certacrypt_crypto_1.DefaultCrypto();
    }
    async transaction(feed, exec, version) {
        const store = await this.getStore(feed);
        await store.storage.ready();
        const head = version || await store.feed.length();
        const tr = new CryptoTransaction(this.crypto, store.storage, head);
        await tr.ready();
        if (exec) {
            const retval = await exec(tr);
            await tr.commit();
            for (const obj of tr.creates) {
                this.crypto.registerKey(obj.key, { feed: hex(feed), index: obj.id, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
            }
            return retval;
        }
        return tr;
    }
    async getInTransaction(id, contentEncoding, tr, feed) {
        const vertexId = typeof id === 'string' ? parseInt(id, 16) : id;
        const vertex = await super.getInTransaction(vertexId, contentEncoding, tr, feed)
            .catch(err => Errors_1.NoAccessError.detectAndThrow(vertexId, err));
        this.registerEdges(vertex);
        return vertex;
    }
    registerEdges(vertex) {
        var _a;
        for (const edge of vertex.getEdges()) {
            const id = edge.ref;
            const key = (_a = edge.metadata) === null || _a === void 0 ? void 0 : _a['key'];
            if (key) {
                this.crypto.registerKey(key, { feed: vertex.getFeed(), index: id, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
            }
        }
    }
    async setEdgeKeys(vertex) {
        for (const edge of vertex.getEdges()) {
            const id = edge.ref;
            const elemFeed = vertex.getFeed() ? Buffer.from(vertex.getFeed(), 'hex') : undefined;
            const feed = edge.feed || elemFeed || await this.getDefaultFeedId();
            const key = this.crypto.getKey(hex(feed), id);
            if (key) {
                if (!edge.metadata)
                    edge.metadata = { key };
                else
                    edge.metadata.key = key;
            }
        }
    }
}
exports.CryptoCore = CryptoCore;
class CryptoTransaction extends hyperobjects_1.Transaction {
    constructor(crypto, store, head) {
        super(store, head);
        this.creates = new Array();
        this.crypto = crypto;
        this.feed = store.feed.feed.key.toString('hex');
    }
    get(id) {
        return super.get(id, (index, data) => this.onRead(id, index, data))
            .catch(err => Errors_1.NoAccessError.detectAndThrow(id, err));
    }
    set(id, data) {
        return super.set(id, data, true, (index, data) => this.onWrite(id, index, data));
    }
    async create(data) {
        const key = this.crypto.generateEncryptionKey(certacrypt_crypto_1.Cipher.ChaCha20_Stream);
        const obj = await super.create(data, true, (index, data) => this.onWrite(undefined, index, data, key));
        obj.key = key;
        this.creates.push(obj);
        return obj;
    }
    onRead(id, index, data) {
        const feed = hex(this.feed);
        if (this.crypto.hasKey(feed, id)) {
            const keydef = { feed, index: id, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream, nonce: index };
            data = this.crypto.decrypt(data, keydef);
        }
        // in about 10% of the cases decoding encrypted data will not throw an error, so we need to detect missing keys somehow else
        const value = validateChecksum(data);
        if (!value) {
            throw new hyper_graphdb_1.Errors.VertexDecodingError(id, new Error('checksum does not match'));
        }
        return value;
    }
    onWrite(id, index, data, key) {
        data = appendChecksum(data);
        if (key) {
            const keydef = { type: certacrypt_crypto_1.Cipher.ChaCha20_Stream, nonce: index };
            return this.crypto.encrypt(data, keydef, key);
        }
        else if (id !== undefined && this.crypto.hasKey(hex(this.feed), id)) {
            const keydef = { feed: hex(this.feed), index: id, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream, nonce: index };
            return this.crypto.encrypt(data, keydef);
        }
        else {
            return data;
        }
    }
}
function hex(feed) {
    if (typeof feed === 'string')
        return feed;
    else
        return feed.toString('hex');
}
function appendChecksum(data) {
    const crc = buffer_crc32_1.default.unsigned(data);
    return Buffer.concat([data, uint32ToBytes(crc)]);
}
function validateChecksum(buf) {
    if (buf.length < 4) {
        return false;
    }
    const data = buf.slice(0, buf.length - 4);
    const rest = buf.slice(buf.length - 4);
    const crc = buffer_crc32_1.default.unsigned(data);
    const actual = uint32FromBytes(rest);
    if (crc === actual) {
        return data;
    }
    else {
        return false;
    }
}
function uint32ToBytes(x) {
    return Uint8Array.from([x, (x << 8), (x << 16), (x << 24)].map(z => z >>> 24));
}
function uint32FromBytes(byteArr) {
    return byteArr.reduce((a, c, i) => a + c * 2 ** (24 - i * 8), 0);
}
//# sourceMappingURL=CryptoCore.js.map