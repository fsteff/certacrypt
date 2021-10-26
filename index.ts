import { Cipher, ICrypto } from 'certacrypt-crypto'
import { CertaCryptGraph } from 'certacrypt-graph'
import { ShareGraphObject, SHARE_VIEW } from 'certacrypt-graph'
import { Corestore, Generator, GraphObject, GRAPH_VIEW, SimpleGraphObject, STATIC_VIEW, Vertex } from 'hyper-graphdb'
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
import { CONTACTS_VIEW, ContactsView, FriendState, Contacts, ContactProfile } from './lib/contacts'
import { Communication, CommunicationView, COMM_PATHS, COMM_VIEW, CommShare } from './lib/communication'
import * as DriveShare from './lib/driveshares'

export {
  GraphObjects,
  ShareGraphObject,
  Hyperdrive,
  enableDebugLogging,
  createUrl,
  parseUrl,
  URL_TYPES,
  User,
  Inbox,
  Contacts,
  ContactProfile,
  FriendState,
  CommShare,
  DriveShare
}

export class CertaCrypt {
  readonly corestore: Corestore
  readonly crypto: ICrypto
  readonly graph: CertaCryptGraph
  readonly sessionRoot: Promise<Vertex<GraphObject>>
  readonly user: Promise<User>
  readonly cacheDb: Promise<CacheDB>
  readonly socialRoot: Promise<Vertex<GraphObject>>
  readonly contacts: Promise<Contacts>

  readonly tmp: Promise<{ drive: Hyperdrive; rootDir: Vertex<GraphObjects.Directory> }>

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
      this.sessionRoot
        .then(async (root) => {
          const secret = <Vertex<GraphObjects.UserKey>>await this.path(USER_PATHS.IDENTITY_SECRET)
          const publicRoot = <Vertex<GraphObjects.UserRoot>>await this.path(USER_PATHS.PUBLIC)
          const user = new User(publicRoot, this.graph, secret)
          resolveUser(user)

          const socialRoot = <Vertex<GraphObject>>await this.path(COMM_PATHS.SOCIAL)
          resolveSocialRoot(socialRoot)
        })
        .catch(console.error)
    } else {
      this.graph = new CertaCryptGraph(corestore, undefined, crypto)
      this.initSession()
        .then(({ root, user, commRoot: socialRoot }) => {
          resolveRoot(root)
          resolveUser(user)
          resolveSocialRoot(socialRoot)
        })
        .catch(console.error)
    }

    this.cacheDb = new Promise(async (resolve) => {
      const root = await this.sessionRoot
      const cache = new CacheDB(this.corestore, this.graph, root)
      const user = await this.user
      const socialRoot = await this.socialRoot
      this.graph.factory.register(CONTACTS_VIEW, (_, codec, tr) => new ContactsView(cache, this.graph, user, codec, this.graph.factory, tr))
      this.graph.factory.register(COMM_VIEW, (_, codec, tr) => new CommunicationView(cache, this.graph, user, codec, this.graph.factory, tr))
      this.graph.factory.register(
        DriveShare.DRIVE_SHARE_VIEW,
        (_, codec, tr) => new DriveShare.DriveShareView(cache, this.graph, socialRoot, codec, this.graph.factory, tr)
      )
      resolve(cache)
    })
    this.contacts = Promise.all([this.socialRoot, this.user, this.cacheDb]).then(async ([socialRoot, user, cacheDb]) => {
      const contacts = new Contacts(this.graph, socialRoot, user, cacheDb)
      await contacts.friends
      return contacts
    })

    this.tmp = this.path('tmp')
      .catch(async () => {
        const root = await this.sessionRoot
        const dir = this.graph.create<GraphObjects.Directory>()
        dir.setContent(new GraphObjects.Directory())
        await this.graph.put(dir)
        root.addEdgeTo(dir, 'tmp')
        await this.graph.put(root)
        return dir
      })
      .then(async (tmp) => {
        return {
          rootDir: <Vertex<GraphObjects.Directory>>tmp,
          drive: await cryptoDrive(this.corestore, this.graph, this.crypto, <Vertex<GraphObjects.Directory>>tmp)
        }
      })

    for (const key in GraphObjects) {
      const Constr = getConstructor(GraphObjects[key])
      if (Constr) {
        this.graph.codec.registerImpl(Constr)
        debug('Registered GraphObject ' + GraphObjects[key]?.name)
      }
    }

    this.graph.factory.register(REFERRER_VIEW, (db, codec, tr) => new ReferrerView(<CryptoCore>db, codec, this.graph.factory, tr))
  }

  private async initSession() {
    const root = this.graph.create<SimpleGraphObject>()
    const apps = this.graph.create<SimpleGraphObject>()
    const shares = this.graph.create<SimpleGraphObject>()
    const commRoot = this.graph.create<SimpleGraphObject>()
    const tmp = this.graph.create<GraphObjects.Directory>()
    tmp.setContent(new GraphObjects.Directory())
    await this.graph.put([root, apps, shares, commRoot, tmp])

    root.addEdgeTo(apps, 'apps')
    root.addEdgeTo(tmp, 'tmp')
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
        else if (res.length === 0) throw new Error('path does not exist: ' + path)
        else throw new Error('path query requires unique results: ' + path)
      })
  }

  public async createShare(vertex: Vertex<GraphObject>, reuseIfExists = true) {
    const shares = await this.path('/shares')

    let shareVertex: Vertex<ShareGraphObject>
    if (reuseIfExists) {
      // checks if exists + loads the keys into the crypto key store
      const view = this.graph.factory.get(STATIC_VIEW)
      const matching = await view
        .query(Generator.from([shares]))
        .out('url', view)
        .generator()
        .filter(async (share) => {
          const target = await view
            .query(Generator.from([share]))
            .out('share')
            .matches((v) => v.equals(vertex))
            .generator()
            .destruct()
          return target.length > 0
        })
        .destruct()
      if (matching.length > 0) {
        shareVertex = <Vertex<ShareGraphObject>>matching[0]
      }
    }

    if (!shareVertex) {
      shareVertex = await this.graph.createShare(vertex, { info: 'share by URL', owner: (await this.user).getPublicUrl() })
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

  public getFileUrl(vertex: Vertex<GraphObjects.DriveGraphObject>, name?: string) {
    return createUrl(vertex, this.graph.getKey(vertex), vertex.getVersion(), URL_TYPES.FILE, name)
  }

  public async getFileByUrl(url: string) {
    const { feed, id, key, name, version } = parseUrl(url)
    this.crypto.registerKey(key, { feed, index: id, type: Cipher.ChaCha20_Stream })

    const tmp = await this.tmp
    const vertex = <Vertex<GraphObjects.DriveGraphObject>>await this.graph.core.get(feed, id, this.graph.codec, version)

    const label = encodeURIComponent(url)
    if (tmp.rootDir.getEdges(label).length === 0) {
      tmp.rootDir.addEdgeTo(vertex, label)
      await this.graph.put(tmp.rootDir)
    }

    return { vertex, name, stat, readFile }

    async function stat() {
      return tmp.drive.promises.lstat(label, { db: { encrypted: true } })
    }

    async function readFile(opts?: { encoding: string } | any) {
      return tmp.drive.promises.readFile(label, opts)
    }
  }

  public async sendShare(share: Vertex<ShareGraphObject>, recipients: User[]) {
    for (const user of recipients) {
      const comm = await Communication.GetOrInitUserCommunication(this.graph, await this.socialRoot, await this.cacheDb, await this.user, user)
      await comm.sendShare(share)
    }
  }

  public async drive(rootDir: Vertex<GraphObjects.Directory> | string): Promise<Hyperdrive> {
    if (typeof rootDir === 'string') {
      const { feed, id, key } = parseUrl(rootDir)
      const vertex = await this.graph.get(id, feed, key)
      rootDir = <Vertex<GraphObjects.Directory>>vertex

      debug(await this.debugDrawGraph(rootDir))
    }
    return cryptoDrive(this.corestore, this.graph, this.crypto, rootDir)
  }

  public async getUserByUrl(url: string) {
    const { feed, id, key } = parseUrl(url)
    const root = <Vertex<GraphObjects.UserRoot>>await this.graph.get(id, feed, key)
    return new User(root, this.graph)
  }

  public async debugDrawGraph(root?: Vertex<GraphObject>, currentDepth = 0, label = '/', visited = new Set<string>(), view?: string): Promise<string> {
    root = root || (await this.sessionRoot)
    let graph = ''
    let type = root.getContent()?.typeName || 'GraphObject'
    let viewStr = !!view ? ' - View: ' + view : ''
    for (let i = 0; i < currentDepth; i++) graph += ' |'
    graph += ` ${label} <${type}> [${root.getId()}] @ ${root.getFeed()}${viewStr}\n`

    const id = root.getId() + '@' + root.getFeed()
    if (visited.has(id)) return graph
    visited.add(id)

    for (const edge of root.getEdges()) {
      try {
        const next = await this.graph.get(edge.ref, edge.feed || root.getFeed(), (<{ key: Buffer }>edge.metadata).key)
        graph += await this.debugDrawGraph(next, currentDepth + 1, edge.label, visited, edge.view)
      } catch (err) {
        graph += err + '\nat ' + edge.ref + '@' + edge.feed?.toString('hex') + '\n'
      }
    }
    return graph
  }
}

type Constructor<T> = new (...args: any[]) => T
function getConstructor<T extends GraphObject>(f: Constructor<T>) {
  if (!f?.constructor?.name) return
  try {
    const inst = new f()
    return (...args) => new f(...args)
  } catch {
    // return undefined
  }
}
