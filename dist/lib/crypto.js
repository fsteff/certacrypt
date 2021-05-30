"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapTrie = exports.cryptoTrie = exports.cryptoCorestore = exports.blobDecryptor = exports.blobEncryptor = exports.streamDecryptor = exports.streamEncryptor = void 0;
const certacrypt_crypto_1 = require("certacrypt-crypto");
const CryptoCore_1 = __importDefault(require("./js/CryptoCore"));
const mountable_hypertrie_1 = __importDefault(require("mountable-hypertrie"));
function streamEncryptor(crypto, feedKeyId) {
    return function encrypt(plaintext, index) {
        if (crypto.hasKey(feedKeyId, index)) {
            const keydef = { feed: feedKeyId, index, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream, nonce: index };
            return crypto.encrypt(plaintext, keydef);
        }
        else {
            return plaintext;
        }
    };
}
exports.streamEncryptor = streamEncryptor;
function streamDecryptor(crypto, feed) {
    return function decrypt(ciphertext, index) {
        if (crypto.hasKey(feed, index)) {
            const keydef = { feed, index, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream, nonce: index };
            return crypto.decrypt(ciphertext, keydef);
        }
        else {
            return ciphertext;
        }
    };
}
exports.streamDecryptor = streamDecryptor;
function blobEncryptor(crypto, feedKeyId) {
    return function encrypt(plaintext, id) {
        if (crypto.hasKey(feedKeyId, id)) {
            const keydef = { feed: feedKeyId, index: id, type: certacrypt_crypto_1.Cipher.XChaCha20_Blob };
            return crypto.encrypt(plaintext, keydef);
        }
        else {
            return plaintext;
        }
    };
}
exports.blobEncryptor = blobEncryptor;
function blobDecryptor(crypto, feedKeyId) {
    return function encrypt(plaintext, id) {
        if (crypto.hasKey(feedKeyId, id)) {
            const keydef = { feed: feedKeyId, index: id, type: certacrypt_crypto_1.Cipher.XChaCha20_Blob };
            return crypto.decrypt(plaintext, keydef);
        }
        else {
            return plaintext;
        }
    };
}
exports.blobDecryptor = blobDecryptor;
function cryptoCorestore(corestore, crypto) {
    const oldGet = corestore.get;
    corestore.get = get;
    return corestore;
    function get(...args) {
        const core = oldGet.call(corestore, ...args);
        core.ready((err) => {
            if (err)
                throw err;
            const feedId = core.key.toString('hex');
            // TODO: create and persist keys!
            CryptoCore_1.default(core, streamEncryptor(crypto, feedId), streamDecryptor(crypto, feedId));
        });
        return core;
    }
}
exports.cryptoCorestore = cryptoCorestore;
async function cryptoTrie(corestore, crypto, feedKey) {
    const trie = new mountable_hypertrie_1.default(corestore, feedKey);
    await new Promise((resolve, reject) => trie.ready((err) => (err ? reject(err) : resolve(null))));
    return wrapTrie(trie, crypto);
}
exports.cryptoTrie = cryptoTrie;
function wrapTrie(trie, crypto) {
    const feedKey = trie.key.toString('hex');
    if (trie.hasCertaCryptTrieWrapper) {
        // seems the corestore does some sort of deduplication, this is only a dirty fix
        return trie;
    }
    trie.hasCertaCryptTrieWrapper = true;
    const encrypt = blobEncryptor(crypto, feedKey);
    const decrypt = blobDecryptor(crypto, feedKey);
    const oldGet = trie.get;
    const oldPut = trie.put;
    trie.get = get;
    trie.put = put;
    return trie;
    function get(key, opts, cb) {
        key = normalize(key);
        opts = mapOpts(opts);
        return tryOrError(() => oldGet.call(trie, key, opts, opts.encrypted ? onData(key, cb) : cb), cb);
        function onData(key, cb) {
            return function (err, node, ...args) {
                if (err)
                    return cb(err);
                if (!node || !node.value)
                    return cb(err, node, ...args);
                if (node.key !== key)
                    return cb(null, null, ...args); // might mean the key does not exist
                const plain = decrypt(node.value, key);
                node = Object.assign({}, node, { value: plain });
                node.hidden = false; // overwrite getter so the node is passed up to the hyperdrive by mountable-hypertrie
                return cb(null, node, ...args);
            };
        }
    }
    function put(key, value, opts, cb) {
        key = normalize(key);
        opts = mapOpts(opts);
        value = opts.encrypted ? encrypt(value, key) : value;
        return tryOrError(() => oldPut.call(trie, key, value, opts, cb), cb);
    }
}
exports.wrapTrie = wrapTrie;
function mapOpts(opts) {
    if (!opts)
        return {};
    if (!opts.encrypted)
        return opts;
    return Object.assign({}, opts, { hidden: true });
}
function normalize(key) {
    if (key.startsWith('/'))
        return key.slice(1);
    else
        return key;
}
function tryOrError(foo, cb) {
    try {
        return foo();
    }
    catch (err) {
        cb(err);
    }
}
//# sourceMappingURL=crypto.js.map