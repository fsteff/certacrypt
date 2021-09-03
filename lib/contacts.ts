import { Generator, GraphObject, IVertex, Vertex, VertexQueries, View } from 'hyper-graphdb'
import { CertaCryptGraph, CryptoCore } from 'certacrypt-graph'
import { CacheDB } from './cacheDB'
import { User, USER_PATHS } from './user'
import { UserRoot } from './graphObjects'

export const CONTACTS_VIEW = 'ContactsView'
export const CONTACTS_PATHS = {
  FRIENDS: '/friends'
}

class Contacts {
  constructor(readonly graph: CertaCryptGraph, readonly root: Vertex<GraphObject>) {}

  async addContact(user: User) {
    this.root.addEdgeTo(user.publicRoot, CONTACTS_PATHS.FRIENDS)
    return this.graph.put(this.root)
  }

  async removeContact(user: User) {
    const edge = this.root
      .getEdges(CONTACTS_PATHS.FRIENDS)
      .filter((e) => e.feed?.equals(Buffer.from(user.publicRoot.getFeed(), 'hex')) && e.ref == user.publicRoot.getId())
    this.root.removeEdge(edge)
    return this.graph.put(this.root)
  }

  async getContacts(err?: (err: Error) => void): Promise<User[]> {
    return this.graph
      .queryAtVertex(this.root)
      .out(CONTACTS_PATHS.FRIENDS)
      .generator()
      .map((v) => new User(<Vertex<UserRoot>>v, this.graph))
      .destruct(err || onError)

    function onError(err: Error) {
      console.error('Failed to load Contact User: ' + err.message)
    }
  }
}

export class ContactsView extends View<GraphObject> {
  public readonly viewName = CONTACTS_VIEW

  constructor(readonly cacheDb: CacheDB, readonly graph: CertaCryptGraph, readonly user: User, contentEncoding, factory, transactions?) {
    super(graph.core, contentEncoding, factory, transactions)
  }

  async out(vertex: IVertex<GraphObject>, label?: string): Promise<VertexQueries<GraphObject>> {
    if (!(vertex instanceof Vertex) || !vertex.getFeed()) {
      throw new Error('ContactsView.out does only accept persisted Vertex instances as input')
    }
    const edges = vertex.getEdges(label)
    const vertices = new Array<Promise<IVertex<GraphObject>>>()
    for (const edge of edges) {
      const feed = edge.feed?.toString('hex') || <string>vertex.getFeed()
      // TODO: version pinning does not work yet
      vertices.push(this.get(feed, edge.ref, /*edge.version*/ undefined, edge.view, edge.metadata))
    }
    return Generator.from(vertices)
  }

  // TODO: label 'all' fetches friends of friends
}
