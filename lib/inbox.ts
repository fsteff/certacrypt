import { ICrypto, Cipher } from 'certacrypt-crypto'
import { CertaCryptGraph } from 'certacrypt-graph'
import { Edge, GraphObject, HyperGraphDB, IVertex, Vertex, VertexQueries, View } from 'hyper-graphdb'
import { User } from './user'

export const ENVELOPE_VIEW = 'EnvelopeView'
export const ENVELOPE_EDGE = 'mail'

export interface EnvelopeEdge extends Edge {
  version: number
  feed: Buffer
  metadata: {
    envelope: Buffer
  }
}

export class Inbox {
  constructor(private crypto: ICrypto, private graph: CertaCryptGraph, private inbox: Vertex<GraphObject>) {}

  async checkEnvelopes(onlyAfter?: number) {
    if (!onlyAfter) onlyAfter = 0

    const feed = await this.graph.core.getStore(this.inbox.getFeed())
    await feed.feed.update(onlyAfter, 5000).catch((err: Error) => console.log(err.message))

    return <Promise<Vertex<GraphObject>[]>>Promise.all(
      this.inbox
        .getEdges(ENVELOPE_EDGE)
        .filter((edge) => edge.version > onlyAfter)
        .filter((edge) => {
          const box = (<EnvelopeEdge>edge).metadata.envelope
          const key = this.crypto.tryOpenEnvelope(box)
          if (Buffer.isBuffer(key)) this.crypto.registerKey(key, { index: edge.ref, feed: edge.feed.toString('hex'), type: Cipher.ChaCha20_Stream })
          return Buffer.isBuffer(key)
        })
        .map(async (edge) => {
          try {
            return await this.graph.get(edge.ref, edge.feed || this.inbox.getFeed())
          } catch (err) {
            console.error(`failed to fetch referred vertex from envelope: ${edge.ref}@${edge.feed || this.inbox.getFeed()} `)
          }
        })
        .filter(async (vertex) => !!(await vertex))
    )
  }

  async postEnvelope(msg: Vertex<GraphObject>, receipient: User) {
    const pubkey = receipient.getPublicKey()
    const secret = this.graph.getKey(msg)
    const box = this.crypto.sealEnvelope(pubkey, secret)
    const edge: EnvelopeEdge = {
      ref: msg.getId(),
      label: ENVELOPE_EDGE,
      version: msg.getVersion(),
      feed: Buffer.from(msg.getFeed(), 'hex'),
      metadata: {
        envelope: box
      }
    }
    this.inbox.addEdge(edge)
    await this.graph.put(this.inbox)
  }

  getVersion() {
    return this.inbox.getVersion()
  }
}
