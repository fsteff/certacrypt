import { ICrypto, Cipher } from 'certacrypt-crypto'
import { Core, Corestore } from 'hyper-graphdb'
import { Feed } from 'hyperobjects'
import { CB1, CBF } from './types'
import wrapHypercore from './js/CryptoCore'
import MountableHypertrie from 'mountable-hypertrie'

interface CryptoTrie extends MountableHypertrie {
    hasCertaCryptTrieWrapper?: boolean,
    get(key: string, opts, cb: CB1<any>)
    put(key: string, value, opts, cb: CBF),
    feed: Feed,
    ready(cb: CBF)
}

export function streamEncryptor(crypto: ICrypto, feedKeyId: string) {
    return function encrypt(plaintext, index) {
        if (crypto.hasKey(feedKeyId, index)) {
            const keydef = { feed: feedKeyId, index, type: Cipher.ChaCha20_Stream, nonce: index }
            return crypto.encrypt(plaintext, keydef)
        } else {
            return plaintext
        }
    }
}

export function streamDecryptor(crypto: ICrypto, feed: string) {
    return function decrypt(ciphertext, index) {
        if (crypto.hasKey(feed, index)) {
            const keydef = { feed, index, type: Cipher.ChaCha20_Stream, nonce: index }
            return crypto.decrypt(ciphertext, keydef)
        } else {
            return ciphertext
        }
    }
}

export function blobEncryptor(crypto: ICrypto, feedKeyId: string) {
    return function encrypt(plaintext: Buffer, id: string) {
        if (crypto.hasKey(feedKeyId, id)) {
            const keydef = { feed: feedKeyId, index: id, type: Cipher.XChaCha20_Blob }
            return crypto.encrypt(plaintext, keydef)
        } else {
            return plaintext
        }
    }
}

export function blobDecryptor(crypto: ICrypto, feedKeyId: string) {
    return function encrypt(plaintext: Buffer, id: string) {
        if (crypto.hasKey(feedKeyId, id)) {
            const keydef = { feed: feedKeyId, index: id, type: Cipher.XChaCha20_Blob }
            return crypto.decrypt(plaintext, keydef)
        } else {
            return plaintext
        }
    }
}

export function cryptoCorestore(corestore: Corestore, crypto: ICrypto) {
    const oldGet = corestore.get

    corestore.get = get
    return corestore

    function get(...args): Feed {
        const core = oldGet.call(corestore, ...args)

        core.ready((err) => {
            if (err) throw err
            const feedId = core.key.toString('hex')

            // TODO: create and persist keys!

            wrapHypercore(core,
                streamEncryptor(crypto, feedId),
                streamDecryptor(crypto, feedId)
            )
        })
        return core
    }
}

export async function cryptoTrie(corestore: Corestore, crypto: ICrypto, feedKey: string) {
    const trie: CryptoTrie = new MountableHypertrie(corestore, feedKey)
    await new Promise((resolve, reject) => trie.ready(err => err ? reject(err) : resolve(null)))

    if (trie.hasCertaCryptTrieWrapper) {
        // seems the corestore does some sort of deduplication, this is only a dirty fix
        return trie
    }
    trie.hasCertaCryptTrieWrapper = true

    const encrypt = blobEncryptor(crypto, feedKey)
    const decrypt = blobDecryptor(crypto, feedKey)

    const oldGet = trie.get
    const oldPut = trie.put
    trie.get = get
    trie.put = put

    return trie

    function get(key, opts, cb) {
        key = normalize(key)
        opts = mapOpts(opts)
        return tryOrError(() => oldGet.call(trie, key, opts, opts.encrypted ? onData(key, cb) : cb), cb)
        function onData(key, cb) {
            return function (err, node, ...args) {
                if (err) return cb(err)
                if (!node || !node.value) return cb(err, node, ...args)
                if (node.key !== key) return cb(null, null, ...args) // might mean the key does not exist
                const plain = decrypt(node.value, key)
                node = Object.assign({}, node, { value: plain })
                node.hidden = false // overwrite getter so the node is passed up to the hyperdrive by mountable-hypertrie
                return cb(null, node, ...args)
            }
        }
    }

    function put(key, value, opts, cb) {
        key =  normalize(key)
        opts = mapOpts(opts)
        value = opts.encrypted ? encrypt(value, key) : value
        return tryOrError(() => oldPut.call(trie, key, value, opts, cb), cb)
    }
}

function mapOpts(opts) {
    if (!opts) return {}
    if (!opts.encrypted) return opts
    return Object.assign({}, opts, { hidden: true })
}

function normalize(key: string) {
    if(key.startsWith('/')) return key.slice(1)
    else return key
}

function tryOrError(foo, cb) {
    try {
        return foo()
    } catch (err) {
        cb(err)
    }
}