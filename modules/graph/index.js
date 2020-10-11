const { Node, Link, File, Share, Directory, Stream } = require('./schema')

const defaultOpts = { db: { encrypted: true, graphNode: true } }

class Graph {
  /**
   * @param {import('hypertrie')} db
   * @param {import('../crypto/lib/Context')} context
   */
  constructor (db, context) {
    this.rootNode = null
    this.idCtr = 1
    this.cryptoContext = context
    this.db = db
  }

  createNode () {
    const node = new Node()
    node.id = this.idCtr++
  }

  createDir () {
    const node = this.createNode()
    node.dir = new Directory()
  }

  createRootNode () {
    this.rootNode = this.createDir()
    return this.rootNode
  }

  async saveNode (node, isNew = false) {
    const self = this
    const feedkey = this.db.feed.key.toString('hex')
    if (isNew) this.cryptoContext.prepareNode(feedkey, node.id)
    return new Promise((resolve, reject) => {
      self.db.put(node, node.id, defaultOpts, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  linkNode (node, target, name, url = null) {
    if (!target.dir && !target.share) throw new Error('target must be a dir or share')

    const link = new Link()
    link.id = node.id
    link.name = name
    link.url = url

    const dir = target.dir || target.share
    if (!dir.children) dir.children = []
    dir.children.push(link)
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
        else resolve(node.value)
      })
    })
  }

  async find (path, node = this.rootNode) {
    if (!node) throw new Error('no root node specified')

    const parts = path.split('/').filter(elem => elem.length > 0)
    if (parts.length === 1) return node

    if (!node.dir && !node.share) throw new Error('root has to be dir or share')
    const dir = node.dir || node.share
    if (!Array.isArray(dir.children)) return null
    for (const child of dir.children) {
      if (parts[0] === child.name) {
        const decoded = await this.getNode(child.id)
        return this.find(path.slice(parts[0].length), decoded)
      }
    }
  }
}

module.exports = Graph
