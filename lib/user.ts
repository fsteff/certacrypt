import { GraphObject, HyperGraphDB, SimpleGraphObject, Vertex } from 'hyper-graphdb'
import { Cipher, ICrypto, Primitives } from 'certacrypt-crypto'
import { CertaCryptGraph, CryptoCore } from 'certacrypt-graph'
import { GraphObjectTypeNames, PreSharedGraphObject, UserKey, UserProfile, UserRoot } from './graphObjects'
import { ReferrerEdge, REFERRER_VIEW } from './referrer'
import { Inbox } from './inbox'
import { createUrl, URL_TYPES } from './url'

export const USER_PATHS = {
  PUBLIC: 'public', // /public              <GraphObject>
  IDENTITY_SECRET: 'identity_secret', // /identity_secret     <UserKey>
  PUBLIC_TO_IDENTITY: 'identity', // /public/identity     <UserKey>
  IDENTITY_SECRET_TO_PUB: 'pub', // /identity_secret/pub <UserKey>
  PUBLIC_TO_PSV: 'psv', // /public/psv          <PreSharedGraphObject>
  PUBLIC_TO_PROFILE: 'profile', // /public/profile      <UserProfile>,
  PUBLIC_TO_INBOX: 'inbox'
}

export class User {
  private identity: Vertex<UserKey>
  private crypto: ICrypto
  private inbox: Inbox

  constructor(readonly publicRoot: Vertex<UserRoot>, readonly graph: CertaCryptGraph, private readonly identitySecret?: Vertex<UserKey>) {
    this.crypto = (<CryptoCore>this.graph.core).crypto

    if (publicRoot.getContent()?.typeName !== GraphObjectTypeNames.USERROOT) {
      throw new Error('passed vertex is not of type UserRoot')
    }

    graph
      .queryAtVertex(this.publicRoot)
      .out(USER_PATHS.PUBLIC_TO_IDENTITY)
      .matches((v) => !!v.getContent() && v.getContent().typeName === GraphObjectTypeNames.USERKEY)
      .vertices()
      .then((results) => {
        if (results.length === 0) {
          throw new Error('User Root has no Identity vertex')
        } else {
          this.identity = <Vertex<UserKey>>results[0]
          if (identitySecret) {
            const secret = Buffer.from(this.identitySecret.getContent().key)
            const pub = Buffer.from(this.identity.getContent().key)
            this.crypto.registerUserKeyPair(pub, secret)
          }
        }
      })
  }

  static async InitUser(graph: CertaCryptGraph, sessionRoot: Vertex<GraphObject>): Promise<User> {
    const inboxVertex = graph.create<GraphObject>()

    const keys = Primitives.generateUserKeyPair()
    const identity = graph.create<UserKey>()
    identity.setContent(new UserKey(keys.pubkey))
    await graph.put([identity, inboxVertex])

    const identitySecret = graph.create<UserKey>()
    identitySecret.setContent(new UserKey(keys.secretkey))

    const publicRoot = graph.create<UserRoot>()
    publicRoot.setContent(new UserRoot())

    publicRoot.addEdgeTo(inboxVertex, USER_PATHS.PUBLIC_TO_INBOX)
    publicRoot.addEdgeTo(identity, USER_PATHS.PUBLIC_TO_IDENTITY)
    identitySecret.addEdgeTo(identity, USER_PATHS.IDENTITY_SECRET_TO_PUB)
    await graph.put([publicRoot, identitySecret])

    sessionRoot.addEdgeTo(publicRoot, USER_PATHS.PUBLIC)
    sessionRoot.addEdgeTo(identitySecret, USER_PATHS.IDENTITY_SECRET)
    await graph.put(sessionRoot)

    const user = new User(publicRoot, graph, identitySecret)
    await user.updatePresharedVertices()

    return user
  }

  async getInbox() {
    if (!this.inbox) {
      const inboxVertex = await this.graph
        .queryAtVertex(this.publicRoot)
        .out(USER_PATHS.PUBLIC_TO_INBOX)
        .vertices()
        .then((results) => {
          if (results.length === 0) {
            throw new Error('User Root has no Inbox vertex')
          }
          return <Vertex<GraphObject>>results[0]
        })
      this.inbox = new Inbox(this.crypto, this.graph, inboxVertex)
    }
    return this.inbox
  }

  getPublicKey() {
    return Buffer.from(this.identity.getContent().key)
  }

  getPublicUrl() {
    return createUrl(this.publicRoot, this.graph.getKey(this.publicRoot), undefined, URL_TYPES.USER)
  }

  isWriteable() {
    return this.publicRoot.getWriteable()
  }

  async updatePresharedVertices() {
    let vertices = await this.queryPresharedVertices()
    // TODO: remove (but persist elsewhere) outdated psv
    if (!Array.isArray(vertices) || vertices.length === 0 || vertices[0].getContent()?.expiryDate < new Date().getUTCSeconds()) {
      const psv1 = this.graph.create<PreSharedGraphObject>()
      const psv2 = this.graph.create<PreSharedGraphObject>()
      const psv3 = this.graph.create<PreSharedGraphObject>()

      psv1.setContent(new PreSharedGraphObject())
      psv2.setContent(new PreSharedGraphObject())
      psv3.setContent(new PreSharedGraphObject())
      await this.graph.put([psv1, psv2, psv3])

      this.publicRoot.addEdgeTo(psv1, USER_PATHS.PUBLIC_TO_PSV)
      this.publicRoot.addEdgeTo(psv2, USER_PATHS.PUBLIC_TO_PSV)
      this.publicRoot.addEdgeTo(psv3, USER_PATHS.PUBLIC_TO_PSV)
      await this.graph.put(this.publicRoot)
      vertices = [psv1, psv2, psv3]
    }
    return vertices
  }

  async setProfile(profile: UserProfile) {
    if (!this.publicRoot.getWriteable()) throw new Error('cannot write profile, hypercore is not writeable')

    let vertex = <Vertex<UserProfile>>await this.graph
      .queryAtVertex(this.publicRoot)
      .out(USER_PATHS.PUBLIC_TO_PROFILE)
      .vertices()
      .then((results) => (results.length > 0 ? results[0] : undefined))
    if (!vertex) {
      vertex = this.graph.create<UserProfile>()
    }
    vertex.setContent(profile)
    await this.graph.put(vertex)
  }

  async getProfile(): Promise<UserProfile | undefined> {
    let results = <Vertex<UserProfile>[]>await this.graph.queryAtVertex(this.publicRoot).out('profile').vertices()
    results = results.filter((v) => !!v.getContent() && v.getContent().typeName === GraphObjectTypeNames.USERPROFILE)
    return results.length > 0 ? (<Vertex<UserProfile>>results[0]).getContent() : undefined
  }

  private async queryPresharedVertices() {
    let vertices = <Vertex<PreSharedGraphObject>[]>await this.graph
      .queryAtVertex(this.publicRoot)
      .out(USER_PATHS.PUBLIC_TO_PSV)
      .matches((v) => !!v.getContent() && v.getContent().typeName === GraphObjectTypeNames.PRESHARED)
      .vertices()
    vertices.sort((v1, v2) => v2.getContent().expiryDate - v1.getContent().expiryDate)
    if (vertices.length === 0) return undefined
    return vertices
  }

  async choosePreSharedVertice(): Promise<Vertex<PreSharedGraphObject> | undefined> {
    let vertices = await this.queryPresharedVertices()
    if (!vertices || vertices.length === 0) return undefined

    const now = new Date().getTime()
    if (vertices[0].getContent().expiryDate > now) {
      vertices = vertices.filter((v) => v.getContent().expiryDate > now)
    }

    return vertices[Math.floor(Math.random() * vertices.length)]
  }

  async referToPresharedVertex(from: Vertex<GraphObject>, label: string) {
    if (!from.getWriteable()) throw new Error('Cannot refer to preshared vertex, referring vertex is not writeable')

    const target = await this.choosePreSharedVertice()
    if (!target) throw new Error("Cannot refer to preshared vertex, user doesn't provide any")

    const refKey = Primitives.generateEncryptionKey()
    const refLabel = Primitives.generateEncryptionKey()
    const edge: ReferrerEdge = {
      label,
      ref: target.getId(),
      feed: Buffer.from(target.getFeed(), 'hex'),
      view: REFERRER_VIEW,
      metadata: { key: this.graph.getKey(target), refKey, refLabel }
    }
    from.addEdge(edge)
    await this.graph.put(from)
  }

  async writeToPresharedVertex(referrer: ReferrerEdge): Promise<Vertex<GraphObject>> {
    const refData = referrer.metadata
    if (!refData || !refData.key || !refData.refKey || !refData.refLabel) {
      throw new Error('ReferrerEdge does not contain required properties: ' + JSON.stringify(referrer))
    }
    const psv = await this.graph.get(referrer.ref, referrer.feed, refData.key)
    if (!psv.getWriteable()) {
      throw new Error('Cannot write to preshared vertex, it is not writeable')
    }

    const target = this.graph.create<GraphObject>()
    await this.graph.put(target)
    this.crypto.registerKey(refData.refKey, { feed: target.getFeed(), index: target.getId(), type: Cipher.ChaCha20_Stream })

    const edge = {
      ref: target.getId(),
      feed: Buffer.from(target.getFeed(), 'hex'),
      label: refData.refLabel.toString('base64')
    }
    psv.addEdge(edge)
    await this.graph.put([target, psv])

    return target
  }
}
