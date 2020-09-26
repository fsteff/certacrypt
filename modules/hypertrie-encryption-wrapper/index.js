/**
 * Uses a simple value encoder to encrypt the data (and preserves the original one)
 * @param {import('hypertrie')} trie
 * @param {(data: Buffer) => Buffer} encrypt
 * @param {(data: Buffer) => Buffer} decrypt
 */
function wrapHypertrie (trie, encrypt, decrypt) {
  const codec = trie.valueEncoding || {}
  if (!codec.encode || !codec.decode) {
    codec.encode = data => data
    codec.decode = data => data
  }

  trie.valueEncoding = {
    encode: data => encrypt(codec.encode(data)),
    decode: data => codec.decode(decrypt(data))
  }

  return trie
}

module.exports = wrapHypertrie
