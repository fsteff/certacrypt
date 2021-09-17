import { CertaCryptGraph, ShareGraphObject } from 'certacrypt-graph'
import { GraphObject, Vertex } from 'hyper-graphdb'
import { GraphMessage, JsonGraphObject, MessageType } from './graphObjects'
import { User } from './user'
import { createUrl, URL_TYPES } from './url'
import { CacheDB } from './cacheDB'
import { debug } from './debug'

export type MsgTypeInit = GraphMessage<{ userUrl: string }, 'Init'>
export type MsgTypeFriendRequest = GraphMessage<{ contactsUrl: string }, 'FriendRequest'>
export type MsgTypeShare = GraphMessage<{ shareUrl: string }, 'Share'>

export type MessageTypes = MsgTypeInit | MsgTypeFriendRequest | MsgTypeShare
export type MessageVertex = Vertex<MessageTypes>

export const COMM_PATHS = {
  SOCIAL: 'social',
  SOCIAL_ROOT_TO_CHANNELS: 'channels',
  MSG_REQUESTS: 'requests',
  MSG_PROVISION: 'provision',
  PARTICIPANTS: 'participants'
}

export class Communication {
  constructor(readonly graph: CertaCryptGraph, readonly userInit: Vertex<MsgTypeInit>, readonly cache: CacheDB) {}

  static async InitUserCommunication(graph: CertaCryptGraph, socialRoot: Vertex<GraphObject>, cache: CacheDB, user: User, addressant: User) {
    const comm = new Communication(graph, message(graph, { userUrl: user.getPublicUrl(), type: 'Init' }), cache)
    await graph.put(comm.userInit)

    let channels: Vertex<GraphObject>
    const results = await graph.queryPathAtVertex(COMM_PATHS.SOCIAL_ROOT_TO_CHANNELS, socialRoot).vertices()
    if (results.length > 0) {
      channels = <Vertex<GraphObject>>results[0]
    } else {
      channels = graph.create<GraphObject>()
      await graph.put(channels)
      socialRoot.addEdgeTo(channels, COMM_PATHS.SOCIAL_ROOT_TO_CHANNELS)
      await graph.put(socialRoot)
    }
    const label = this.getUserLabel(addressant)
    channels.addEdgeTo(comm.userInit, label)
    await graph.put(channels)

    const mail = await user.getInbox()
    await mail.postEnvelope(comm.userInit, addressant)
    await comm.checkInbox(addressant)

    debug('Initialized Communication between ' + ((await user.getProfile())?.username || user.getPublicUrl()) + ' (current user) and ' + ((await addressant.getProfile())?.username || addressant.getPublicUrl()))

    return comm
  }

  static async GetOrInitUserCommunication(graph: CertaCryptGraph, socialRoot: Vertex<GraphObject>, cache: CacheDB, user: User, addressant: User) {
    const existing = await graph
      .queryPathAtVertex(COMM_PATHS.SOCIAL_ROOT_TO_CHANNELS + '/' + Communication.getUserLabel(addressant), socialRoot)
      .generator()
      .destruct()
    if (existing.length > 0) {
      const comm = new Communication(graph, <Vertex<MsgTypeInit>>existing[0], cache)
      await comm.checkInbox(addressant)
      return comm
    } else {
      return Communication.InitUserCommunication(graph, socialRoot, cache, user, addressant)
    }
  }

  static getUserLabel(user: User) {
    return user.publicRoot.getId() + '@' + user.publicRoot.getFeed()
  }

  async getParticipants() {
    const prt = await this.graph.queryAtVertex(this.userInit).out(COMM_PATHS.PARTICIPANTS).generator().destruct()
    return prt
    //return <Promise<Vertex<MsgTypeInit>[]>>this.graph.queryPathAtVertex(COMM_PATHS.PARTICIPANTS, this.userInit).generator().destruct()
  }

  async checkInbox(participant: User) {
    const mail = await participant.getInbox(true)
    const cachePath = `communication/user/${Communication.getUserLabel(participant)}/inboxLastCheckedVersion}`
    const lastChecked = await this.cache.get<number>(cachePath)
    const envelopes = <Vertex<MsgTypeInit>[]>await mail.checkEnvelopes(lastChecked)
    await this.cache.put(cachePath, mail.getVersion())

    const added = new Array<Vertex<MsgTypeInit>>()
    for (const init of envelopes) {
      const existing = this.userInit.getEdges(COMM_PATHS.PARTICIPANTS).filter((e) => e.ref === init.getId() && e.feed?.toString('hex') === init.getFeed())
      if (existing.length === 0) {
        added.push(init)
        this.userInit.addEdgeTo(init, COMM_PATHS.PARTICIPANTS)
      }
    }
    if (added.length > 0) {
      await this.graph.put(this.userInit)
    }
    return added
  }

  private message<T extends string, V extends object>(value: MessageType<T> & V): Vertex<GraphMessage<V, T>> {
    return message(this.graph, value)
  }

  private async sendMessage(message: MessageVertex, path: string) {
    await this.graph.put(message)
    this.userInit.addEdgeTo(message, path)
    await this.graph.put(this.userInit)
  }

  async sendFriendRequest(contacts: Vertex<GraphObject>) {
    const contactsUrl = createUrl(contacts, this.graph.getKey(contacts), undefined, URL_TYPES.CONTACTS)
    const request = this.message({ contactsUrl, type: 'FriendRequest' })
    return this.sendMessage(request, COMM_PATHS.MSG_REQUESTS)
  }

  async sendShare(share: Vertex<ShareGraphObject>) {
    const shareUrl = createUrl(share, this.graph.getKey(share), undefined, URL_TYPES.SHARE)
    const msg = this.message({ shareUrl, type: 'Share' })
    return this.sendMessage(msg, COMM_PATHS.MSG_PROVISION)
  }

  async getRequests() {
    const prs = await this.graph.queryAtVertex(this.userInit).out(COMM_PATHS.PARTICIPANTS).generator().destruct()

    const iter = this.graph
      .queryPathAtVertex(COMM_PATHS.PARTICIPANTS + '/' + COMM_PATHS.MSG_REQUESTS, this.userInit)
      .values((v) => <MessageTypes>v.getContent())
    const results = new Array<MsgTypeFriendRequest>()
    for await (const msg of iter) {
      if (!['FriendRequest'].includes(msg.type)) {
        throw new Error('Message is not a request: ' + msg.type)
      }
      results.push(<MsgTypeFriendRequest>msg)
    }
    return results
  }

  async getSentRequests() {
    const iter = this.graph.queryPathAtVertex(COMM_PATHS.MSG_REQUESTS, this.userInit).values((v) => <MessageTypes>v.getContent())
    const results = new Array<MsgTypeFriendRequest>()
    for await (const msg of iter) {
      if (!['FriendRequest'].includes(msg.type)) {
        throw new Error('Message is not a request: ' + msg.type)
      }
      results.push(<MsgTypeFriendRequest>msg)
    }
    return results
  }

  async getProvisions() {
    const iter = this.graph
      .queryPathAtVertex(COMM_PATHS.PARTICIPANTS + '/' + COMM_PATHS.MSG_PROVISION, this.userInit)
      .values((v) => <MessageTypes>v.getContent())
    const results = new Array<MsgTypeShare>()
    for await (const msg of iter) {
      if (!['Share'].includes(msg.type)) {
        throw new Error('Message is not a provision: ' + msg.type)
      }
    }
    return results
  }

  async getSentProvisions() {
    const iter = this.graph.queryPathAtVertex(COMM_PATHS.MSG_PROVISION, this.userInit).values((v) => <MessageTypes>v.getContent())
    const results = new Array<MsgTypeShare>()
    for await (const msg of iter) {
      if (!['Share'].includes(msg.type)) {
        throw new Error('Message is not a provision: ' + msg.type)
      }
    }
    return results
  }
}

function message<T extends string, V extends object>(graph: CertaCryptGraph, value: MessageType<T> & V): Vertex<GraphMessage<V, T>> {
  const vertex = graph.create<GraphMessage<V, T>>()
  vertex.setContent(Object.assign(new JsonGraphObject<MessageType<T>>(), value))
  return vertex
}
