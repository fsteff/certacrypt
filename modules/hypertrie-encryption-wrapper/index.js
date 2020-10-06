/**
 * Uses a simple value encoder to encrypt the data (and preserves the original one)
 * @param {import('hypertrie')} trie
 * @param {(data: Buffer) => Buffer} encrypt
 * @param {(data: Buffer) => Buffer} decrypt
 */
function wrapHypertrie (trie, encrypt, decrypt) {
  const oldGet = trie.get
  const oldPut = trie.put

  trie.get = get
  trie.put = put

  return trie

  function get (key, opts, cb) {
    return tryOrError(() => oldGet.call(trie, key, injectCodec(opts), cb), cb)
  }

  function put (key, value, opts, cb) {
    return tryOrError(() => oldPut.call(trie, key, value, injectCodec(opts), cb), cb)
  }

  function injectCodec (opts) {
    if (!opts || !opts.hidden) return opts

    opts = opts || {}
    const codec = opts.valueEncoding || {}
    if (!codec.encode || !codec.decode) {
      codec.encode = data => data
      codec.decode = data => data
    }

    opts.valueEncoding = {
      encode: data => encrypt(codec.encode(data)),
      decode: data => codec.decode(decrypt(data))
    }
    return opts
  }
}

function tryOrError (foo, cb) {
  try {
    return foo()
  } catch (err) {
    cb(err)
  }
}

module.exports = wrapHypertrie
