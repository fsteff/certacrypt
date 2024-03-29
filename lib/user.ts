import { GraphObject, Restriction, Vertex } from '@certacrypt/hyper-graphdb'
import { Cipher, ICrypto, Primitives } from '@certacrypt/certacrypt-crypto'
import { CertaCryptGraph, CryptoCore } from '@certacrypt/certacrypt-graph'
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
  private identity: Promise<Vertex<UserKey>>
  private crypto: ICrypto

  constructor(readonly publicRoot: Vertex<UserRoot>, readonly graph: CertaCryptGraph, private readonly identitySecret?: Vertex<UserKey>) {
    this.crypto = (<CryptoCore>this.graph.core).crypto

    if (publicRoot.getContent()?.typeName !== GraphObjectTypeNames.USERROOT) {
      throw new Error('passed vertex is not of type UserRoot')
    }

    this.identity = graph
      .queryAtVertex(this.publicRoot)
      .out(USER_PATHS.PUBLIC_TO_IDENTITY)
      .matches((v) => !!v.getContent() && v.getContent().typeName === GraphObjectTypeNames.USERKEY)
      .generator()
      .destruct(onError)
      .then((results) => {
        if (results.length === 0) {
          return Promise.reject(new Error('User Root has no Identity vertex'))
        } else {
          const identity = <Vertex<UserKey>>results[0]
          if (identitySecret) {
            const secret = Buffer.from(this.identitySecret.getContent().key)
            const pub = Buffer.from(identity.getContent().key)
            this.crypto.registerUserKeyPair(pub, secret)
          }
          return identity
        }
      })

    function onError(err: Error) {
      console.error('Failed to load user Identity: ' + err)
    }
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

  async getInbox(update = false) {
    if (update) {
      const feed = await this.graph.core.getStore(this.publicRoot.getFeed())
      await feed.feed.update(this.publicRoot.getVersion(), 100).catch((err: Error) => console.log(err.message))
    }

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
    return new Inbox(this.crypto, this.graph, inboxVertex)
  }

  async getPublicKey() {
    return Buffer.from((await this.identity).getContent().key)
  }

  getSecretKey(): Buffer | null {
    let key = this.identitySecret?.getContent()?.key
    if (key) return Buffer.from(key)
    else return null
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

      const me = this.getPublicUrl()
      const psvObj = new PreSharedGraphObject()
      psvObj.owner = me
      psv1.setContent(psvObj)
      psv2.setContent(psvObj)
      psv3.setContent(psvObj)
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
    if (!(profile instanceof UserProfile)) throw new Error('profile has to be of type UserProfile')

    let vertex = <Vertex<UserProfile>>await this.graph
      .queryAtVertex(this.publicRoot)
      .out(USER_PATHS.PUBLIC_TO_PROFILE)
      .vertices()
      .then((results) => (results.length > 0 ? results[0] : undefined))
    if (vertex) {
      vertex.setContent(profile)
      await this.graph.put(vertex)
    }
    if (!vertex) {
      vertex = this.graph.create<UserProfile>()
      vertex.setContent(profile)
      await this.graph.put(vertex)
      this.publicRoot.addEdgeTo(vertex, USER_PATHS.PUBLIC_TO_PROFILE)
      await this.graph.put(this.publicRoot)
    }
  }

  async getProfile(): Promise<UserProfile | undefined> {
    //await this.graph.updateVertex(this.publicRoot)
    let results = <Vertex<UserProfile>[]>await this.graph.queryAtVertex(this.publicRoot).out(USER_PATHS.PUBLIC_TO_PROFILE).vertices()
    for (const profileVertex of results) {
      const profile = profileVertex.getContent()
      if (profile?.typeName === GraphObjectTypeNames.USERPROFILE) {
        return profile
      }
    }
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

  async referToPresharedVertex(from: Vertex<GraphObject>, label: string, restrictions?: Restriction[]) {
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
      metadata: { key: this.graph.getKey(target), refKey, refLabel },
      restrictions,
      version: target.getVersion()
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
