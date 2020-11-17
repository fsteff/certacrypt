const MountableHypertrie = require('mountable-hypertrie')
const primitives = require('../crypto/lib/primitives')
const wrapHypertrie = require('../hypertrie-encryption-wrapper')

const defaultOpts = { encrypted: true, graphNode: true, hidden: true }

class Graph {
  static prefix () {
    return '.enc/'
  }

  /**
   * @param {import('hypertrie')} db
   * @param {import('../crypto/lib/Context')} context
   */
  constructor (db, context) {
    this.rootNode = null
    this.idCtr = 1
    this.cryptoContext = context
    this.db = db
    this.prefix = Graph.prefix()
    this.encryptNode = context.getNodeEncryptor(this.db.feed.key.toString('hex'))
    this.remoteGraphs = new Map()
  }

  createNode () {
    const node = { id: this._nextId() }
    return node
  }

  async createDir (createStat = true, save = true) {
    const node = this.createNode()
    node.dir = {}
    if (createStat) {
      node.dir.file = { id: this._nextId() }
    }
    if (save) {
      const driveKey = this.db.feed.key.toString('hex')
      this.cryptoContext.prepareNode(driveKey, node.id)
      if (createStat) {
        this.cryptoContext.prepareStat(driveKey, node.dir.file.id)
      }
      await this.saveNode(node)
    }
    return node
  }

  async createFile (save = true) {
    const node = this.createNode()
    node.file = { id: this._nextId() }
    if (save) {
      const driveKey = this.db.feed.key.toString('hex')
      this.cryptoContext.prepareNode(driveKey, node.id)
      this.cryptoContext.prepareStat(driveKey, node.file.id)
      await this.saveNode(node)
    }
    return node
  }

  async createShare (name, save = true) {
    const node = this.createNode()
    node.share = { name: name }
    if (save) {
      const driveKey = this.db.feed.key.toString('hex')
      this.cryptoContext.prepareNode(driveKey, node.id)
      await this.saveNode(node)
    }
    return node
  }

  async createRootNode (mainKey = null, save = true) {
    this.rootNode = await this.createDir(false, false)
    if (mainKey || save) {
      if (typeof mainKey === 'string') {
        mainKey = Buffer.from(mainKey, 'hex')
      }
      const key = mainKey || primitives.generateEncryptionKey()
      const driveKey = this.db.feed.key.toString('hex')
      this.cryptoContext.prepareNode(driveKey, this.rootNode.id, key)
      if (save) await this.saveNode(this.rootNode)
    }
    return this.rootNode
  }

  async registerRootNode (mainKey, id) {
    if (typeof mainKey === 'string') {
      mainKey = Buffer.from(mainKey, 'hex')
    }
    if (!id) {
      id = (this.prefix + '1')
    }
    const driveKey = this.db.feed.key.toString('hex')
    this.cryptoContext.prepareNode(driveKey, id, mainKey)
    this.rootNode = await this.getNode(id)
  }

  async saveNode (node) {
    const self = this
    return new Promise((resolve, reject) => {
      const ciphertext = self.encryptNode(node, node.id)
      self.db.put(node.id, ciphertext, defaultOpts, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async linkNode (node, target, name, remoteFeed = null, save = true) {
    if (!target.dir && !target.share) throw new Error('target must be a dir or share')

    const link = {
      id: node.id,
      name: name,
      remoteFeed: remoteFeed
    }

    const dir = target.dir || target.share
    if (!dir.children) dir.children = []
    dir.children.push(link)
    if (save) {
      await this.saveNode(target)
    }
  }

  unlinkNode (node, target) {
    const dir = target.dir || target.share
    if (!Array.isArray(dir.children)) throw new Error('node does not have children')
    const idx = dir.children.findIndex(n => n.id === node.id)
    dir.children.splice(idx, 1)
  }

  async getNode (id) {
    const self = this
    return await new Promise((resolve, reject) => {
      self.db.get(id, defaultOpts, (err, node) => {
        if (err) reject(err)
        else if (!node) reject(new Error('node ' + id + ' not found'))
        else resolve(node.value)
      })
    })
  }

  async find (path, node = this.rootNode) {
    if (!node) throw new Error('no root node specified')

    let parts
    if (Array.isArray(path)) parts = path
    else parts = path.split('/').filter(elem => elem.length > 0)
    if (parts.length === 0) return { node, trie: this.db }

    if (!node.dir && !node.share) throw new Error('root has to be dir or share')
    const dir = node.dir || node.share
    if (!Array.isArray(dir.children)) {
      if (parts.length === 1) return { parent: node, trie: this.db }
      else return { trie: this.db }
    }
    for (const child of dir.children) {
      if (parts[0] === child.name) {
        if (child.remoteFeed) {
          const graph = await this.getRemoteGraph(this.db.corestore, child.remoteFeed)
          const share = await graph.getNode(child.id)
          if (parts.length === 1) return { node: share, parent: node, trie: this.db }

          const result = await graph.find(parts, share)
          if (parts.length === 2 && !result.parent) result.parent = share
          return result
        } else {
          const decoded = await this.getNode(child.id)
          if (parts.length === 1) return { node: decoded, parent: node, trie: this.db }

          const result = await this.find(parts.slice(1), decoded)
          if (parts.length === 2 && !result.parent) result.parent = decoded
          return result
        }
      }
    }
    return {}
  }

  async getRemoteGraph (corestore, key) {
    const keyStr = Buffer.isBuffer(key) ? key.toString('hex') : key
    if (this.remoteGraphs.has(keyStr)) return this.remoteGraphs.get(keyStr)

    const db = new MountableHypertrie(corestore, key)
    await new Promise((resolve, reject) => db.ready(err => err ? reject(err) : resolve()))
    const remoteGraph = new Graph(db, this.cryptoContext)
    wrapHypertrie(
      db.trie,
      this.cryptoContext.getStatEncryptor(keyStr),
      this.cryptoContext.getStatDecryptor(keyStr),
      null,
      this.cryptoContext.getNodeDecryptor(keyStr)
    )
    this.remoteGraphs.set(keyStr, remoteGraph)
    return remoteGraph
  }

  _nextId () {
    return this.prefix + (this.idCtr++).toString(16)
  }

  // TODO: more efficient approach, e.g. binary search or looking at history
  async getIdFromHistory () {
    const self = this
    let id = 1
    while (await exists(Graph.prefix() + id)) id++

    this.idCtr = id
    return Graph.prefix() + id

    async function exists (path) {
      return await self.getNode(path).then(() => true).catch(() => false)
    }
  }
}

module.exports = Graph
