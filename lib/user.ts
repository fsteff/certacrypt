import { GraphObject, HyperGraphDB, SimpleGraphObject, Vertex } from 'hyper-graphdb'
import { ICrypto, Primitives } from 'certacrypt-crypto'
import { CertaCryptGraph } from 'certacrypt-graph'
import { GraphObjectTypeNames, PreSharedGraphObject, UserKey, UserProfile } from './graphObjects'
import { Edge } from 'hyper-graphdb/lib/Vertex'
import { REFERRER_VIEW } from './referrer'

export class User {
  private identity: Vertex<UserKey>

  constructor(readonly publicRoot: Vertex<GraphObject>, readonly graph: CertaCryptGraph, private readonly identitySecret?: Vertex<UserKey>) {
    graph
      .queryAtVertex(this.publicRoot)
      .out('identity')
      .matches((v) => !!v.getContent() && v.getContent().typeName === GraphObjectTypeNames.USERKEY)
      .vertices()
      .then((results) => {
        if (results.length === 0) {
          throw new Error('User Root has no Identity vertex')
        } else {
          this.identity = <Vertex<UserKey>>results[0]
        }
      })
  }

  static async InitUser(graph: CertaCryptGraph, sessionRoot: Vertex<GraphObject>): Promise<User> {
    const keys = Primitives.generateUserKeyPair()
    const identity = graph.create<UserKey>()
    identity.setContent(new UserKey(keys.pubkey))

    const identitySecret = graph.create<UserKey>()
    identitySecret.setContent(new UserKey(keys.secretkey))

    const publicRoot = graph.create<GraphObject>()
    // TODO: profile, PSV

    publicRoot.addEdgeTo(identity, 'identity')
    identitySecret.addEdgeTo(identity, 'pub')
    await graph.put([publicRoot, identitySecret])

    sessionRoot.addEdgeTo(publicRoot, 'public')
    sessionRoot.addEdgeTo(identitySecret, 'identity_secret')
    await graph.put(sessionRoot)

    return new User(publicRoot, graph, identitySecret)
  }

  isWriteable() {
    return this.publicRoot.getWriteable()
  }

  async setProfile(profile: UserProfile) {
    if (!this.publicRoot.getWriteable()) throw new Error('cannot write profile, hypercore is not writeable')

    let vertex = <Vertex<UserProfile>>await this.graph
      .queryAtVertex(this.publicRoot)
      .out('profile')
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

  async choosePreSharedVertice(): Promise<Vertex<PreSharedGraphObject> | undefined> {
    let vertices = <Vertex<PreSharedGraphObject>[]>await this.graph
      .queryAtVertex(this.publicRoot)
      .out('psv')
      .matches((v) => !!v.getContent() && v.getContent().typeName === GraphObjectTypeNames.PRESHARED)
      .vertices()
    vertices.sort((v1, v2) => v2.getContent().expiryDate - v1.getContent().expiryDate)

    if (vertices.length === 0) return undefined

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
    const refLabel = Primitives.generateEncryptionKey().toString('base64')

    const edge: Edge = {
      label,
      ref: target.getId(),
      feed: Buffer.from(target.getFeed(), 'hex'),
      view: REFERRER_VIEW,
      metadata: { key: this.graph.getKey(target), refKey, refLabel }
    }
    from.addEdge(edge)
    await this.graph.put(from)
  }
}
