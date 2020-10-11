/**
 * Uses a simple value encoder to encrypt the data (and preserves the original one)
 * @param {import('hypertrie')} trie
 * @param {(data: Buffer) => Buffer} encrypt
 * @param {(data: Buffer) => Buffer} decrypt
 */
function wrapHypertrie (trie, encryptStat, decryptStat, encryptNode, decryptNode) {
  const oldGet = trie.get
  const oldPut = trie.put

  trie.get = get
  trie.put = put

  return trie

  function get (key, opts, cb) {
    opts = mapOpts(opts)
    const decrypt = opts.graphNode ? decryptNode : decryptStat
    return tryOrError(() => oldGet.call(trie, key, opts, opts.encrypted ? onData(key, cb) : cb), cb)

    function onData (key, cb) {
      return function (err, node, ...args) {
        if (err) return cb(err)
        if (!node || !node.value) return cb(err, node, ...args)
        const plain = decrypt(node.value, key)
        node = Object.assign({}, node, { value: plain })
        node.hidden = false // overwrite getter so the node is passed up to the hyperdrive by mountable-hypertrie
        return cb(null, node, ...args)
      }
    }
  }

  function put (key, value, opts, cb) {
    opts = mapOpts(opts)
    const encrypt = opts.graphNode ? passThrough : encryptStat
    return tryOrError(() => oldPut.call(trie, key, opts.encrypted ? encrypt(value, key) : value, opts, cb), cb)
  }
}

function mapOpts (opts) {
  if (!opts) return {}
  if (!opts.encrypted) return opts
  return Object.assign({}, opts, { hidden: true })
}

function passThrough (data) {
  return data
}

function tryOrError (foo, cb) {
  try {
    return foo()
  } catch (err) {
    cb(err)
  }
}

module.exports = wrapHypertrie
