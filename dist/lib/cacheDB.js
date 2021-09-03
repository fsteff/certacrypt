"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheDB = void 0;
const certacrypt_crypto_1 = require("certacrypt-crypto");
const cryptoCore_1 = __importDefault(require("./js/cryptoCore"));
const hypertrie_1 = __importDefault(require("hypertrie"));
class CacheDB {
    constructor(corestore, graph, sessionRoot) {
        const seed = certacrypt_crypto_1.Primitives.hash(Buffer.concat([Buffer.from(sessionRoot.getFeed(), 'hex'), Buffer.from([sessionRoot.getId()])]));
        const secret = certacrypt_crypto_1.Primitives.hash(Buffer.concat([graph.getKey(sessionRoot), seed]));
        const namespace = corestore.namespace(seed.toString('hex'));
        const feed = cryptoCore_1.default(namespace.default(), encrypt, decrypt);
        this.db = new hypertrie_1.default(undefined, { feed, valueEncoding: 'json' });
        function encrypt(data, index) {
            return certacrypt_crypto_1.Primitives.encryptBlockStream(data, index, secret);
        }
        function decrypt(data, index) {
            return certacrypt_crypto_1.Primitives.decryptBlockStream(data, index, secret);
        }
    }
    get(key) {
        return new Promise((resolve, reject) => this.db.get(key, (err, result) => err ? reject(err) : resolve(result)));
    }
    put(key, value) {
        return new Promise((resolve, reject) => this.db.put(key, value, (err, result) => err ? reject(err) : resolve(result)));
    }
    del(key) {
        return new Promise((resolve, reject) => this.db.get(key, (err, result) => err ? reject(err) : resolve(result)));
    }
}
exports.CacheDB = CacheDB;
//# sourceMappingURL=cacheDB.js.map