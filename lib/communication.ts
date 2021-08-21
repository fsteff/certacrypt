import { CertaCryptGraph } from "certacrypt-graph";
import { GraphObject, Vertex } from "hyper-graphdb";
import { GraphMessage, JsonGraphObject, MessageType } from "./graphObjects";
import { User } from "./user";

export type MsgTypeInit = GraphMessage<{}, 'Init'>
export type MsgTypeFriendRequest = GraphMessage<{contactsUrl: string}, 'FriendRequest'>
export type MsgTypeShare = GraphMessage<{shareUrl: string}, 'Share'>

function message<T extends string, V extends object>(graph: CertaCryptGraph, value: MessageType<T> & V): Vertex<GraphMessage<V, T>> {
    const vertex = graph.create<GraphMessage<V, T>>()
    vertex.setContent(Object.assign(new JsonGraphObject<MessageType<T>>(), value))
    return vertex
}

export class Communication {

    constructor(readonly graph: CertaCryptGraph, readonly userInit: Vertex<MsgTypeInit>) {
    }

    static async InitUserCommunication(graph: CertaCryptGraph, commRoot: Vertex<GraphObject>, user: User, addressant: User) {
        const comm = new Communication(graph, message(graph, {type: 'Init'}))
        await graph.put(comm.userInit)

        let userComm: Vertex<GraphObject> 
        const results = (await graph.queryPathAtVertex('/users', commRoot).vertices())
        if(results.length > 0) {
            userComm = <Vertex<GraphObject>> results[0]
        } else {
            userComm = graph.create<GraphObject>()
            await graph.put(userComm)
            commRoot.addEdgeTo(userComm, '/users')
            await graph.put(commRoot)
        }
        const label = addressant.getPublicUrl()
        userComm.addEdgeTo(comm.userInit, label)
        await graph.put(userComm)

        return comm
    }

    private message<T extends string, V extends object>(value: MessageType<T> & V): Vertex<GraphMessage<V, T>> {
        return message(this.graph, value)
    }


}

