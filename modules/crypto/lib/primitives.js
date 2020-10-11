
const sodium = require('sodium-native')

module.exports = {
  encryptBlob,
  decryptBlob,
  encryptBlockStream,
  decryptBlockStream,
  generateEncryptionKey,
  extractEncryptionKey
}

/**
 * XChaCha20 encryption, automatically generates a random nonce (192 Bit) and prepends it to the ciphtertext
 * @param {Buffer} plaintext
 * @param {Buffer} key
 * @returns {Buffer}
 */
function encryptBlob (plaintext, key) {
  const nonce = Buffer.allocUnsafe(sodium.crypto_stream_NONCEBYTES)
  sodium.randombytes_buf(nonce)

  const ciphertext = Buffer.allocUnsafe(sodium.crypto_stream_NONCEBYTES + plaintext.length)
  nonce.copy(ciphertext)

  sodium.crypto_stream_xor(ciphertext.slice(sodium.crypto_stream_NONCEBYTES), plaintext, nonce, key)
  return ciphertext
}

/**
 * @param {Buffer} ciphertext
 * @param {Buffer} key
 * @returns {Buffer}
 */
function decryptBlob (ciphertext, key) {
  const nonce = ciphertext.slice(0, sodium.crypto_stream_NONCEBYTES)
  const plaintext = Buffer.allocUnsafe(ciphertext.length - sodium.crypto_stream_NONCEBYTES)
  sodium.crypto_stream_xor(plaintext, ciphertext.slice(sodium.crypto_stream_NONCEBYTES), nonce, key)
  return plaintext
}

/**
 * ChaCha20 encryption for random access to a block stream, uses the index as nonce.
 * Use ONLY when it is guaranteed that the (key,nonce) combination is only used once (e.g. for a hypercore)!
 * @param {Buffer} plaintext data to encrypt
 * @param {number} index
 * @param {Buffer} key
 * @returns {Buffer}
 */
function encryptBlockStream (plaintext, index, key) {
  const ciphertext = Buffer.allocUnsafe(plaintext.length)
  const nonce = Buffer.alloc(sodium.crypto_stream_chacha20_NONCEBYTES)
  // eslint-disable-next-line no-undef
  nonce.writeBigUInt64LE(BigInt(index))

  sodium.crypto_stream_chacha20_xor(ciphertext, plaintext, nonce, key)
  return ciphertext
}

/**
 * @param {Buffer} ciphertext
 * @param {number} index
 * @param {Buffer} key of length sodium.crypto_stream_chacha20_KEYBYTES
 * @returns {Buffer}
 */
function decryptBlockStream (ciphertext, index, key) {
  const plaintext = Buffer.allocUnsafe(ciphertext.length)
  const nonce = Buffer.alloc(sodium.crypto_stream_chacha20_NONCEBYTES)
  // eslint-disable-next-line no-undef
  nonce.writeBigUInt64LE(BigInt(index))

  sodium.crypto_stream_chacha20_xor(plaintext, ciphertext, nonce, key)
  return plaintext
}

/**
 * @returns {import('sodium-native').SecureBuffer}
 */
function generateEncryptionKey () {
  const key = sodium.sodium_malloc(sodium.crypto_stream_KEYBYTES)
  sodium.randombytes_buf(key)
  return key
}

/**
 * Copies the buffer to a memory-protected buffer and zeroes out the original one
 * @param {Buffer} buf
 * @returns {import('sodium-native').SecureBuffer}
 */
function extractEncryptionKey (buf) {
  if (!Buffer.isBuffer(buf)) {
    throw new Error('key is not an instance of Buffer')
  }
  if (buf.length !== sodium.crypto_stream_KEYBYTES) {
    throw new Error('key has invalid length')
  }
  const key = sodium.sodium_malloc(sodium.crypto_stream_KEYBYTES)
  buf.copy(key)
  buf.fill(0)
  return key
}
