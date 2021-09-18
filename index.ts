import { Cipher, ICrypto, DefaultCrypto } from 'certacrypt-crypto'
import { CertaCryptGraph, SHARE_GRAPHOBJECT } from 'certacrypt-graph'
import { ShareGraphObject, SHARE_VIEW } from 'certacrypt-graph'
import { Core, Corestore, GraphObject, SimpleGraphObject, Vertex, IVertex } from 'hyper-graphdb'
import * as GraphObjects from './lib/graphObjects'
import { parseUrl, createUrl, URL_TYPES } from './lib/url'
import { cryptoDrive } from './lib/drive'
import { Hyperdrive } from './lib/types'
import { enableDebugLogging, debug } from './lib/debug'
import { REFERRER_VIEW, ReferrerView } from './lib/referrer'
import { CryptoCore } from 'certacrypt-graph'
import { User, USER_PATHS } from './lib/user'
import { Inbox } from './lib/inbox'
import { CacheDB } from './lib/cacheDB'
import { CONTACTS_VIEW, ContactsView, Contacts, ContactProfile } from './lib/contacts'
import { COMM_PATHS } from './lib/communication'

export { GraphObjects, ShareGraphObject, Hyperdrive, enableDebugLogging, createUrl, parseUrl, URL_TYPES, User, Inbox, Contacts, ContactProfile }

export class CertaCrypt {
  readonly corestore: Corestore
  readonly crypto: ICrypto
  readonly graph: CertaCryptGraph
  readonly sessionRoot: Promise<Vertex<GraphObject>>
  readonly user: Promise<User>
  readonly cacheDb: Promise<CacheDB>
  readonly socialRoot: Promise<Vertex<GraphObject>>
  readonly contacts: Promise<Contacts>

  constructor(corestore: Corestore, crypto: ICrypto, sessionUrl?: string) {
    this.corestore = corestore
    this.crypto = crypto

    let resolveRoot, resolveUser, resolveSocialRoot
    this.sessionRoot = new Promise((resolve, _) => {
      resolveRoot = resolve
    })
    this.user = new Promise((resolve, _) => {
      resolveUser = resolve
    })
    this.socialRoot = new Promise((resolve, _) => {
      resolveSocialRoot = resolve
    })

    if (sessionUrl) {
      const { feed, id, key } = parseUrl(sessionUrl)
      this.graph = new CertaCryptGraph(corestore, feed, crypto)
      this.graph.get(id, feed, key).then(resolveRoot)
      this.sessionRoot.then(async (root) => {
        const secret = <Vertex<GraphObjects.UserKey>>await this.path(USER_PATHS.IDENTITY_SECRET)
        const publicRoot = <Vertex<GraphObjects.UserRoot>>await this.path(USER_PATHS.PUBLIC)
        const user = new User(publicRoot, this.graph, secret)
        resolveUser(user)

        const socialRoot = <Vertex<GraphObject>>await this.path(COMM_PATHS.SOCIAL)
        resolveSocialRoot(socialRoot)
      })
    } else {
      this.graph = new CertaCryptGraph(corestore, undefined, crypto)
      this.initSession().then(({ root, user, commRoot: socialRoot }) => {
        resolveRoot(root)
        resolveUser(user)
        resolveSocialRoot(socialRoot)
      })
    }

    this.cacheDb = new Promise(async (resolve) => {
      const root = await this.sessionRoot
      const cache = new CacheDB(this.corestore, this.graph, root)
      const user = await this.user
      this.graph.factory.register(CONTACTS_VIEW, (_, codec, tr) => new ContactsView(cache, this.graph, user, codec, this.graph.factory, tr))
      resolve(cache)
    })
    this.contacts = Promise.all([this.socialRoot, this.user, this.cacheDb])
    .then(async ([socialRoot, user, cacheDb]) => {
      const contacts = new Contacts(this.graph, socialRoot, user, cacheDb)
      await contacts.friends
      return contacts
    })

    for (const key in GraphObjects) {
      const Constr = getConstructor(GraphObjects[key])
      if(Constr) {
        this.graph.codec.registerImpl(Constr)
        debug('Registered GraphObject ' + GraphObjects[key]?.name)
      }
    }

    this.graph.factory.register(REFERRER_VIEW, (db, codec, tr) => new ReferrerView(<CryptoCore>db, codec, this.graph.factory, tr))
  }

  private async initSession() {
    const root = this.graph.create<SimpleGraphObject>()
    const apps = this.graph.create<SimpleGraphObject>()
    //const contacts = this.graph.create<SimpleGraphObject>()
    const shares = this.graph.create<SimpleGraphObject>()
    const commRoot = this.graph.create<SimpleGraphObject>()
    await this.graph.put([root, apps, shares, commRoot])

    root.addEdgeTo(apps, 'apps')
    //root.addEdgeTo(contacts, 'contacts')
    root.addEdgeTo(shares, 'shares')
    root.addEdgeTo(commRoot, COMM_PATHS.SOCIAL)
    root.addEdgeTo(commRoot, 'contacts', undefined, undefined, CONTACTS_VIEW)
    await this.graph.put(root)

    const user = await User.InitUser(this.graph, root)

    debug(`initialized session ${createUrl(root, this.graph.getKey(root))}`)

    return { root, user, commRoot }
  }

  public async getSessionUrl() {
    const root = await this.sessionRoot
    return createUrl(root, this.graph.getKey(root))
  }

  public async path(path: string): Promise<Vertex<GraphObject>> {
    return this.graph
      .queryPathAtVertex(path, await this.sessionRoot)
      .vertices()
      .then((res) => {
        if (res.length === 1) return <Vertex<GraphObject>>res[0]
        else if (res.length === 0) throw new Error('path does not exist')
        else throw new Error('path query requires unique results')
      })
  }

  public async share(vertex: Vertex<GraphObject>, reuseIfExists = true) {
    const shares = await this.path('/shares')

    let shareVertex: Vertex<ShareGraphObject>
    if (reuseIfExists) {
      // checks if exists + loads the keys into the crypto key store
      const existing = await this.graph
        .queryAtVertex(await this.sessionRoot)
        .out('shares')
        .out('url')
        .matches((v) => v.equals(vertex))
        .vertices()
      if (existing.length > 0) {
        const edges = shares.getEdges('url').filter((e) => e.ref === vertex.getId() && (e.feed?.toString('hex') || shares.getFeed()) === vertex.getFeed())
        if (edges.length > 0) shareVertex = <Vertex<ShareGraphObject>>await this.graph.get(edges[0].ref, edges[0].feed || shares.getFeed())
      }
    }

    if (!shareVertex) {
      shareVertex = this.graph.create<ShareGraphObject>()
      const content = new ShareGraphObject()
      content.info = 'share by URL'
      shareVertex.setContent(content)
      shareVertex.addEdgeTo(vertex, 'share')
      await this.graph.put(shareVertex)

      shares.addEdgeTo(shareVertex, 'url', undefined, undefined, SHARE_VIEW)
      await this.graph.put(shares)

      debug(`created share to vertex ${vertex.getFeed()}/${vertex.getId()} at ${shareVertex.getFeed()}/${shareVertex.getId()}`)
    }

    return shareVertex
  }

  public async mountShare(target: Vertex<GraphObject>, label: string, url: string) {
    const { feed, id, key } = parseUrl(url)
    const vertex = await this.graph.get(id, feed, key)
    target.addEdgeTo(vertex, label, undefined, undefined, SHARE_VIEW)
    await this.graph.put(target)
    debug(`mounted share from URL ${url} to ${target.getFeed()}/${target.getId()}->${label}`)
    debug(await this.debugDrawGraph())
  }

  public async drive(rootDir: Vertex<GraphObjects.Directory> | string): Promise<Hyperdrive> {
    if(typeof rootDir === 'string') {
      const { feed, id, key } = parseUrl(rootDir)
      const vertex = await this.graph.get(id, feed, key)
      rootDir = <Vertex<GraphObjects.Directory>> vertex
      /*if(vertex.getContent()?.typeName === SHARE_GRAPHOBJECT) {
        const dir = await this.graph.queryAtVertex(vertex).out().vertices()
        if(dir.length !== 1 || dir[0].getContent()?.typeName !== GraphObjects.GraphObjectTypeNames.DIRECTORY) {
          throw new Error('expected exactly one shared directory, got ' + dir.map(v => v.getContent()?.typeName))
        }
        rootDir = <Vertex<GraphObjects.Directory>> dir[0]
      } else if (vertex.getContent()?.typeName === GraphObjects.GraphObjectTypeNames.DIRECTORY) {
        rootDir = <Vertex<GraphObjects.Directory>> vertex
      } else {
        throw new Error('expected a directory from the passed drive url, got ' + vertex.getContent()?.typeName)
      }*/

      debug(await this.debugDrawGraph(rootDir))
    }
    return cryptoDrive(this.corestore, this.graph, this.crypto, rootDir)
  }

  public async getUserByUrl(url: string) {
    const { feed, id, key } = parseUrl(url)
    const root = <Vertex<GraphObjects.UserRoot>>await this.graph.get(id, feed, key)
    return new User(root, this.graph)
  }

  public async debugDrawGraph(root?: Vertex<GraphObject>, currentDepth = 0, label = '/', visited = new Set<string>()): Promise<string> {
    root = root || (await this.sessionRoot)
    let graph = ''
    let type = root.getContent()?.typeName || 'GraphObject'
    for (let i = 0; i < currentDepth; i++) graph += ' |'
    graph += ` ${label} <${type}> [${root.getId()}] @ ${root.getFeed()}\n`

    const id = root.getId() + '@' + root.getFeed()
    if (visited.has(id)) return graph
    visited.add(id)

    for (const edge of root.getEdges()) {
      try {
        const next = await this.graph.get(edge.ref, edge.feed || root.getFeed(), (<{ key: Buffer }>edge.metadata).key)
        graph += await this.debugDrawGraph(next, currentDepth + 1, edge.label, visited)
      } catch (err) {
        graph += err + '\nat ' + edge.ref + '@' + edge.feed?.toString('hex') + '\n'
      }
    }
    return graph
  }
}

type Constructor<T> = new (...args: any[]) => T
function getConstructor<T extends GraphObject>(f: Constructor<T>) {
  if(! f?.constructor?.name) return
  try {
    const inst = new f()
    return (...args) => new f(...args)
  } catch {
    // return undefined
  }
}