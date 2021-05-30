import { GraphObject, HyperGraphDB, SimpleGraphObject, Vertex } from 'hyper-graphdb'
import { ICrypto, Primitives } from 'certacrypt-crypto'
import { GraphObjectTypeNames, UserKey, UserProfile } from './graphObjects'

export class User {
  private identity: Vertex<UserKey>

  constructor(readonly publicRoot: Vertex<GraphObject>, readonly graph: HyperGraphDB, private readonly identitySecret?: Vertex<UserKey>) {
    graph
      .queryAtVertex(this.publicRoot)
      .out('identity')
      .vertices()
      .then((results) => {
        results = results.filter((v) => !!v.getContent() && v.getContent().typeName === GraphObjectTypeNames.USERKEY)
        if (results.length === 0) {
          throw new Error('User Root has no Identity vertex')
        } else {
          this.identity = <Vertex<UserKey>>results[0]
        }
      })
  }

  static async InitUser(graph: HyperGraphDB, sessionRoot: Vertex<GraphObject>, crypto: ICrypto): Promise<User> {
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
}
