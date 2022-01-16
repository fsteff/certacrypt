import { ICrypto, Cipher } from '@certacrypt/certacrypt-crypto'
import { CertaCryptGraph } from '@certacrypt/certacrypt-graph'
import { Edge, GraphObject, HyperGraphDB, IVertex, Vertex, VertexQueries, View } from '@certacrypt/hyper-graphdb'
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

    return <Promise<Vertex<GraphObject>[]>>Promise.all(
      this.inbox
        .getEdges(ENVELOPE_EDGE)
        .filter((edge) => edge.version > onlyAfter)
        .filter((edge) => {
          const box = (<EnvelopeEdge>edge).metadata.envelope
          const key = this.crypto.tryOpenEnvelope(box)
          if (Buffer.isBuffer(key)) {
            // console.log('registering key for envelope ' + edge.ref + '@' + edge.feed.toString('hex') + ': ' + key.toString('hex').substr(0, 2) + '...')
            this.crypto.registerKey(key, { index: edge.ref, feed: edge.feed.toString('hex'), type: Cipher.ChaCha20_Stream })
          }
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
    const pubkey = await receipient.getPublicKey()
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
    // safety check to make sure certacrypt-graph doesn't ever inject the key
    if (this.inbox.getEdges().find((e) => !!e.metadata?.['key'])) throw new Error('envelope edge has key')
  }

  getVersion() {
    return this.inbox.getVersion()
  }
}
