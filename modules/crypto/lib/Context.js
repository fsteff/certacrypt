const crypto = require('./primitives')
const GraphShema = require('../../graph/schema')
const KeyCache = require('./KeyCache')

/**
 * @typedef { import('../../graph/schema') } GraphShema
 * @typedef {GraphShema.Link} Link
 * @typedef {GraphShema.Node} Node
 */

class CryptoContext {
  // TODO: store data in a cache and create a simple garbage collection mechanism
  constructor () {
    this.keystore = new KeyCache()
  }

  /**
   * @param {string} feed hypertrie discovery key
   * @returns {(node: Node, id: string) => Buffer}
   */
  getNodeEncryptor (feed) {
    const self = this
    return function encrypt (node, id) {
      const secret = self.keystore.get(feed, id)
      if (!secret) {
        throw new Error('no encryption key present for feed node ' + feed + ' ' + id)
      }
      return self.encryptNode(node, feed, secret)
    }
  }

  /**
   * Generates a new encryption key for a new graph node
   * @param {string} feed hypertrie discovery key
   * @param {string} id hypertrie key
   */
  prepareNode (feed, id) {
    const secret = crypto.generateEncryptionKey()
    this.keystore.set(feed, id, secret)
  }

  /**
   * @param {string} feed hypertrie discovery key
   * @returns {(ciphertext: Buffer, id: string) => Node}
   */
  getNodeDecryptor (feed) {
    const self = this
    return function decrypt (ciphertext, id) {
      const secret = self.keystore.get(feed, id)
      if (!secret) {
        throw new Error('no encryption key present for feed node ' + feed + ' ' + id)
      }
      return self.decryptNode(ciphertext, secret)
    }
  }

  /**
   * @param {Buffer} ciphertext
   * @param {import('sodium-native').SecureBuffer} secret encrytion key
   * @param {string} feed key as hex
   */
  decryptNode (ciphertext, secret, feed) {
    const block = crypto.decryptBlob(ciphertext, secret)
    const node = GraphShema.Node.decode(block)
    this.extractKeys(node, feed)

    return node
  }

  /**
   * @param {Node} node
   * @param {import('sodium-native').SecureBuffer} secret
   * @returns {Buffer}
   */
  encryptNode (node, feed, secret) {
    const self = this
    if (GraphShema.Node.verify(node)) {
      throw new Error('Invalid Node, cannot encode and encrypt')
    }
    const children = (node.share || node.dir).children
    if (Array.isArray(children)) {
      const copy = children.map(child => {
        child = Object.assign({}, child)
        child.key = self.keystore.get(feed, child.id)
        return child
      })
      if (node.share) node.share.children = copy
      else node.dir = copy
    }

    const block = GraphShema.Node.encode(node)
    return crypto.encryptBlob(block, secret)
  }

  /**
   * @param {Node} node to extract from
   * @param {string} feed key as hex
   * @param {import('../../graph/schema').Node} node
   */
  extractKeys (node, feed) {
    if (node.share || node.dir) {
      /** @type {Array<import('../../graph/schema').Link>|null|undefined} */
      const children = (node.share || node.dir).children
      if (Array.isArray(children)) {
        for (const child of children) {
          if (child.url) {
            const url = new URL(child.url)
            feed = url.hostname
          }
          const secret = crypto.extractEncryptionKey(child.key)
          this.keystore.set(feed, child.id, secret)
        }
      }
    }
  }

  /**
   * @param {string} feed key as hex
   * @returns {(stat: Buffer, id: string) => Buffer}
   */
  getStatEncryptor (feed) {
    const self = this
    return function encrypt (stat, id) {
      const secret = self.keystore.get(feed, id)
      if (!secret) {
        throw new Error('no encryption key present for feed stat ' + feed + ' ' + id)
      }
      return crypto.encryptBlob(stat, secret)
    }
  }

  /**
   * Generates a new encryption key for metadata stat block
   * @param {string} feed key as hex
   * @param {string} id hypertrie key
   */
  prepareStat (feed, id) {
    const secret = crypto.generateEncryptionKey()
    this.keystore.set(feed, id, secret)
  }

  /**
   * @param {string} feed key as hex
   * @returns {(ciphertext: Buffer, id: string) => Buffer}
   */
  getStatDecryptor (feed) {
    const self = this
    return function decrypt (ciphertext, id) {
      const secret = self.keystore.get(feed, id)
      if (!secret) {
        throw new Error('no encryption key present for feed stat ' + feed + ' ' + id)
      }
      return crypto.decryptBlob(ciphertext, secret)
    }
  }

  /**
   * @param {string} feed key as hex
   * @param {number} index hypercore enctry index
   */
  prepareStream (feed, index) {
    const secret = crypto.generateEncryptionKey()
    this.keystore.set(feed, index, secret)
  }

  /**
   * @param {string} feed key as hex
   * @param {number} index hypercore enctry index
   */
  preparePublicStream (feed, index) {
    this.keystore.set(feed, index, null)
  }

  /**
   * @param {string} feed key as hex
   * @returns {(block: Buffer, index: number) => Buffer} encrypted block
   */
  getStreamEncryptor (feed) {
    const self = this
    return function encrypt (block, index) {
      const secret = self.keystore.get(feed, index)
      if (!secret) {
        console.info('not encryption key for stream ' + feed + ' at ' + index)
        return block
      }
      return crypto.encryptBlockStream(block, index, secret)
    }
  }

  /**
   * @param {string} feed key as hex
   * @returns {(ciphertext: Buffer, index: number) => Buffer} decrypted ciphertext
   */
  getStreamDecryptor (feed) {
    const self = this
    return function decrypt (ciphertext, index) {
      const secret = self.keystore.get(feed, index)
      if (!secret) {
        console.info('not decryption key for stream ' + feed + ' at ' + index)
        return ciphertext
      }
      return crypto.decryptBlockStream(ciphertext, index, secret)
    }
  }
}

module.exports = CryptoContext
