/**
 *
 * @param {import('hypertrie')} trie
 * @param {(data: Buffer) => Buffer} encrypt
 * @param {(data: Buffer) => Buffer} decrypt
 */
function wrapHypertrie (trie, encrypt, decrypt) {
  const oldGet = trie.get
  const oldPut = trie.put

  trie.get = get
  trie.put = put

  function get (key, opts, cb) {
    oldGet.call(trie, key, opts, onData)

    function onData (err, data) {
      if (err) return cb(err)
      return decrypt(data)
    }
  }

  function put (key, value, opts, cb) {
    const ciphertext = encrypt(value)
    oldPut.call(trie, key, ciphertext, opts, cb)
  }

  return trie
}

module.exports = wrapHypertrie
