import { Edge, Generator, GraphObject, IVertex, Vertex, VertexQueries, View } from 'hyper-graphdb'
import { CertaCryptGraph, CryptoCore } from 'certacrypt-graph'
import { CacheDB } from './cacheDB'
import { User, USER_PATHS } from './user'
import { UserProfile, UserRoot } from './graphObjects'
import { CommShare, Communication, COMM_PATHS, COMM_VIEW, MsgTypeInit, VirtualCommShareVertex } from './communication'
import { parseUrl, URL_TYPES } from './url'
import { debug } from './debug'

export const CONTACTS_VIEW = 'ContactsView'
export const CONTACTS_PATHS = {
  SOCIAL_TO_FRIENDS: 'friends',
  CONTACTS_TO_PROFILES: 'profiles'
}
export enum FriendState {
  NONE = 'none',
  REQUEST_SENT = 'sent',
  REQUEST_RECEIVED = 'received',
  FRIENDS = 'friends'
}

export class Contacts {
  readonly friends: Promise<Vertex<GraphObject>>

  constructor(readonly graph: CertaCryptGraph, readonly socialRoot: Vertex<GraphObject>, readonly user: User, readonly cacheDb: CacheDB) {
    this.friends = this.graph
      .queryPathAtVertex(CONTACTS_PATHS.SOCIAL_TO_FRIENDS, this.socialRoot)
      .generator()
      .destruct()
      .then(async (results) => {
        let friends: Vertex<GraphObject>
        if (results.length === 0) {
          friends = this.graph.create<GraphObject>()
          await this.graph.put(friends)
          this.socialRoot.addEdgeTo(friends, CONTACTS_PATHS.SOCIAL_TO_FRIENDS)
          await this.graph.put(this.socialRoot)
        } else {
          friends = <Vertex<GraphObject>>results[0]
        }
        return friends
      })
  }

  async addFriend(user: User) {
    const friends = await this.friends
    friends.addEdgeTo(user.publicRoot, Communication.getUserLabel(user))
    await this.graph.put(friends)
    const comm = await Communication.GetOrInitUserCommunication(this.graph, this.socialRoot, this.cacheDb, this.user, user)
    await comm.sendFriendRequest(friends)
  }

  async getFriendState(user: User): Promise<FriendState> {
    if (this.user.publicRoot.equals(user.publicRoot)) return FriendState.NONE

    const channel = await Communication.GetOrInitUserCommunication(this.graph, this.socialRoot, this.cacheDb, this.user, user)
    const received = (await channel.getRequests()).filter((r) => r.type === 'FriendRequest').length > 0
    const sent = (await channel.getSentRequests()).filter((r) => r.type === 'FriendRequest').length > 0

    if (received && sent) return FriendState.FRIENDS
    else if (received) return FriendState.REQUEST_RECEIVED
    else if (sent) return FriendState.REQUEST_SENT
    else return FriendState.NONE
  }

  async removeFriend(user: User) {
    const friends = await this.friends
    const edge = friends.getEdges(Communication.getUserLabel(user))
    friends.removeEdge(edge)
    return this.graph.put(friends)
  }

  async getFriends(err?: (err: Error) => void): Promise<User[]> {
    return this.graph
      .queryAtVertex(await this.friends)
      .out()
      .generator()
      .map((v) => new User(<Vertex<UserRoot>>v, this.graph))
      .destruct(err || onError)

    function onError(err: Error) {
      console.error('Failed to load Friend User: ' + err.message)
    }
  }

  async getAllContacts(): Promise<ContactProfile[]> {
    const view = this.graph.factory.get(CONTACTS_VIEW)
    const contacts = await this.graph
      .queryPathAtVertex(CONTACTS_PATHS.CONTACTS_TO_PROFILES, this.socialRoot, view)
      //.out(USER_PATHS.PUBLIC_TO_PROFILE)
      .generator()
      .map((profile: VirtualContactVertex) => profile.getContent())
      .destruct(onError)
    const map = new Map<String, ContactProfile>()
    contacts.forEach((profile) => map.set(profile.publicUrl, profile))
    map.delete(this.user.getPublicUrl())
    return [...map.values()]

    function onError(err: Error) {
      console.error('failed to load contact profile: ' + err)
    }
  }

  async getAllReceivedShares(): Promise<CommShare[]> {
    const view = this.graph.factory.get(COMM_VIEW)
    const shares = await this.graph
      .queryPathAtVertex(COMM_PATHS.COMM_TO_RCV_SHARES, this.socialRoot, view)
      .generator()
      .map((v: VirtualCommShareVertex) => v.getContent())
      .destruct(onError)
    return shares

    function onError(err: Error) {
      console.error('failed to load share: ' + err)
    }
  }

  async getAllSentShares(): Promise<CommShare[]> {
    const view = this.graph.factory.get(COMM_VIEW)
    const shares = await this.graph
      .queryPathAtVertex(COMM_PATHS.COMM_TO_SENT_SHARES, this.socialRoot, view)
      .generator()
      .map((v: VirtualCommShareVertex) => v.getContent())
      .destruct(onError)
    const dedup: CommShare[] = []
    for (const share of shares) {
      const foundIdx = dedup.findIndex((s) => s.equals(share))
      if (foundIdx < 0) {
        dedup.push(share)
      } else {
        const found = dedup[foundIdx]
        found.sharedWith = distinct(found.sharedWith.concat(share.sharedWith))
      }
    }

    return dedup

    function onError(err: Error) {
      console.error('failed to load share: ' + err)
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
    let vertices: Array<Promise<IVertex<GraphObject>>>
    if (label === CONTACTS_PATHS.CONTACTS_TO_PROFILES) {
      return this.getAllContacts(vertex)
    } else {
      vertices = []
      for (const edge of edges) {
        const feed = edge.feed?.toString('hex') || <string>vertex.getFeed()
        // TODO: version pinning does not work yet
        vertices.push(this.get(feed, edge.ref, /*edge.version*/ undefined, edge.view, edge.metadata))
      }
    }
    return Generator.from(vertices)
  }

  private async getAllContacts(socialRoot: Vertex<GraphObject>): Promise<Generator<VirtualContactVertex>> {
    const friends = await this.graph
      .queryAtVertex(socialRoot)
      .out(CONTACTS_PATHS.SOCIAL_TO_FRIENDS)
      .out() // each <vertexId>@<feed>
      .generator()
      .map((v) => new User(<Vertex<UserRoot>>v, this.graph))
      .destruct(onError)
    // TODO: caching
    // get all friends's contacts in parallel
    const promises = new Array<Promise<Generator<User>>>()
    for (const friend of friends) {
      promises.push(
        // get all friends
        Communication.GetOrInitUserCommunication(this.graph, socialRoot, this.cacheDb, this.user, friend).then(async (channel) => {
          const contacts = new Array<Generator<User>>(Generator.from([friend]))
          // get all friend requests (containing urls to their friend list)
          for (const request of await channel.getRequests()) {
            // parse url to the friend list
            debug('found friend request from ' + channel.userInit.getContent().userUrl)
            const { feed, id, key, type } = parseUrl(request.contactsUrl)
            if (type !== URL_TYPES.CONTACTS) throw new Error('URL is not of type Contacts: ' + type)
            // load vertex from url - TODO: use existing transactions(?)
            this.graph.registerVertexKey(id, feed, key)
            const userFriendsRoot = <Vertex<GraphObject>>await this.get(feed, id) //<Vertex<GraphObject>>await this.graph.get(id, feed, key)
            // get friends from list and instantiate users
            debug('loading friends of user ' + channel.userInit.getContent().userUrl)
            const userFriends = this.graph
              .queryAtVertex(userFriendsRoot, this)
              .out()
              .generator()
              .map((vertex: Vertex<UserRoot>) => new User(vertex, this.graph))
            contacts.push(userFriends)
          }
          return Generator.from(contacts).flatMap(async (gen) => await gen.destruct(onError))
        })
      )
    }

    return Generator.from(promises).flatMap(async (gen) => {
      return gen.map(async (user) => {
        const profile = await user.getProfile()
        const url = user.getPublicUrl()
        debug('loaded user profile for ' + profile?.username + ' (' + url + ')')
        return new VirtualContactVertex(url, profile)
      })
    })

    function onError(err: Error) {
      console.error('failed to load contact profile for view: ' + err.message)
    }
  }
}

export class ContactProfile extends UserProfile {
  publicUrl: string
}

export class VirtualContactVertex implements IVertex<ContactProfile> {
  constructor(readonly publicUrl: string, readonly userProfile?: UserProfile) {}

  getContent(): ContactProfile {
    const profile = new ContactProfile()
    Object.assign(profile, { publicUrl: this.publicUrl }, this.userProfile)
    return profile
  }
  getEdges(label?: string): Edge[] {
    throw new Error('Method not implemented.')
  }
  equals<V>(other: IVertex<V>): boolean {
    throw new Error('Method not implemented.')
  }
}

function distinct<T>(values: T[]) {
  return [...new Set(values)]
}
