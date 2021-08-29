import { CertaCryptGraph, ShareGraphObject } from "certacrypt-graph";
import { GraphObject, Vertex } from "hyper-graphdb";
import { GraphMessage, JsonGraphObject, MessageType } from "./graphObjects";
import { User } from "./user";
import { createUrl, URL_TYPES } from './url'

export type MsgTypeInit = GraphMessage<{}, 'Init'>
export type MsgTypeFriendRequest = GraphMessage<{contactsUrl: string}, 'FriendRequest'>
export type MsgTypeShare = GraphMessage<{shareUrl: string}, 'Share'>

export type MessageTypes = MsgTypeInit | MsgTypeFriendRequest | MsgTypeShare
export type MessageVertex = Vertex<MessageTypes>

export const COMM_ROOT = '/communication'
export const COMM_PATHS = {
    COMM_ROOT_TO_USERS: 'users',
    MSG_REQUESTS: 'requests',
    MSG_PROVISION: 'provision',
    PARTICIPANTS: 'participants'
}


export class Communication {
    participants: Promise<Vertex<MsgTypeInit>[]>

    constructor(readonly graph: CertaCryptGraph, readonly userInit: Vertex<MsgTypeInit>) {
        // fixme: should participant be linked or each comm be a separate channel?
        this.participants = new Promise<Vertex<MsgTypeInit>[]>((resolve, _) => {

        })
    }

    static async InitUserCommunication(graph: CertaCryptGraph, commRoot: Vertex<GraphObject>, user: User, addressant: User) {
        const comm = new Communication(graph, message(graph, {type: 'Init'}))
        await graph.put(comm.userInit)

        let userComm: Vertex<GraphObject> 
        const results = (await graph.queryPathAtVertex(COMM_PATHS.COMM_ROOT_TO_USERS, commRoot).vertices())
        if(results.length > 0) {
            userComm = <Vertex<GraphObject>> results[0]
        } else {
            userComm = graph.create<GraphObject>()
            await graph.put(userComm)
            commRoot.addEdgeTo(userComm, COMM_PATHS.COMM_ROOT_TO_USERS)
            await graph.put(commRoot)
        }
        const label = addressant.getPublicUrl()
        userComm.addEdgeTo(comm.userInit, label)
        await graph.put(userComm)

        const mail = await user.getInbox()
        await mail.postEnvelope(userComm, addressant)

        //const addrMail = await addressant.getInbox()
        //const envelopes = <Vertex<MsgTypeInit>[]> await addrMail.checkEnvelopes()

        return comm
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
        const vertices = <MessageVertex[]> await this.graph.queryPathAtVertex(COMM_PATHS.MSG_REQUESTS, this.userInit).vertices()
        const contents = vertices.map(v => v.getContent())
        contents.forEach(c => {
            if(!['FriendRequest'].includes(c.type)) {
                throw new Error('Message is not a request: ' + c.type)
            }
        })
        return contents
    }

    async getProvisions() {
        const vertices = <MessageVertex[]> await this.graph.queryPathAtVertex(COMM_PATHS.MSG_PROVISION, this.userInit).vertices()
        const contents = vertices.map(v => v.getContent())
        contents.forEach(c => {
            if(!['Share'].includes(c.type)) {
                throw new Error('Message is not a provision: ' + c.type)
            }
        })
        return contents;
    }
}

function message<T extends string, V extends object>(graph: CertaCryptGraph, value: MessageType<T> & V): Vertex<GraphMessage<V, T>> {
    const vertex = graph.create<GraphMessage<V, T>>()
    vertex.setContent(Object.assign(new JsonGraphObject<MessageType<T>>(), value))
    return vertex
}