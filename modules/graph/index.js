const primitives = require('../crypto/lib/primitives')

const defaultOpts = { encrypted: true, graphNode: true, hidden: true }

class Graph {
  /**
   * @param {import('hypertrie')} db
   * @param {import('../crypto/lib/Context')} context
   */
  constructor (db, context) {
    this.rootNode = null
    this.idCtr = 1 // TODO: load latest value from db - history or db entry?
    this.cryptoContext = context
    this.db = db
    this.prefix = '.enc/'
    this.encryptNode = context.getNodeEncryptor(this.db.feed.key.toString('hex'))
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

  async createRootNode (mainKey = null, save = true) {
    this.rootNode = await this.createDir(false, false)
    if (mainKey || save) {
      // TODO: persist somehow
      const key = mainKey || primitives.generateEncryptionKey()
      const driveKey = this.db.feed.key.toString('hex')
      this.cryptoContext.keystore.set(driveKey, this.rootNode.id, key)
      if (save) await this.saveNode(this.rootNode)
    }
    return this.rootNode
  }

  async registerRootNode (mainKey, id = (this.prefix + '1')) {
    const driveKey = this.db.feed.key.toString('hex')
    this.cryptoContext.keystore.set(driveKey, id, mainKey)
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

  async linkNode (node, target, name, url = null, save = true) {
    if (!target.dir && !target.share) throw new Error('target must be a dir or share')

    const link = {
      id: node.id,
      name: name,
      url: url
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
    if (parts.length === 0) return { node }

    if (!node.dir && !node.share) throw new Error('root has to be dir or share')
    const dir = node.dir || node.share
    if (!Array.isArray(dir.children)) {
      if (parts.length === 1) return { parent: node }
      else return {}
    }
    for (const child of dir.children) {
      if (parts[0] === child.name) {
        const decoded = await this.getNode(child.id)
        if (parts.length === 1) return { node: decoded, parent: node }
        const result = await this.find(parts.slice(1), decoded)
        if (parts.length === 2 && !result.parent) result.parent = decoded
        return result
      }
    }
    return {}
  }

  _nextId () {
    return this.prefix + (this.idCtr++).toString(16)
  }
}

module.exports = Graph
