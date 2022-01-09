import { Cipher, ICrypto } from 'certacrypt-crypto'
import { CryptoCore } from 'certacrypt-graph'
import { Edge, Generator, GraphObject, GRAPH_VIEW, IVertex, QueryResult, QueryState, Vertex, View } from 'hyper-graphdb'
import { debug } from './debug'
import { PreSharedGraphObject } from './graphObjects'

export const REFERRER_VIEW = 'ReferrerView'

export interface ReferrerEdge extends Edge {
  view: string
  feed: Buffer
  metadata: {
    key: Buffer
    refKey: Buffer
    refLabel: Buffer
    version?: Buffer
  }
}

export class ReferrerView extends View<GraphObject> {
  public viewName = REFERRER_VIEW
  private crypto: ICrypto

  constructor(db: CryptoCore, contentEncoding, factory, transactions?) {
    super(db, contentEncoding, factory, transactions)
    this.crypto = db.crypto
  }

  public async out(state: QueryState<GraphObject>, label?: string): Promise<QueryResult<GraphObject>> {
    const vertex = <Vertex<GraphObject>>state.value
    if (typeof vertex.getId !== 'function' || typeof vertex.getFeed !== 'function' || !vertex.getFeed()) {
      throw new Error('Vertex is not a a physical one, cannot use it for a ReferrerView')
    }

    const edges = vertex.getEdges(label)
    const vertices: QueryResult<GraphObject> = []
    for (const edge of edges) {
      const feed = edge.feed || Buffer.from(<string>vertex.getFeed(), 'hex')
      const meta = <{ refKey: Buffer; refLabel: Buffer }>edge.metadata
      if (meta.refKey && meta.refLabel) {
        try {
          const result = await this.get({ ...edge, feed, metadata: meta }, state)
          for (const res of await result) {
            vertices.push(res)
          }
        } catch (err) {
          // referred might not yet exist
          debug(`cannot access referred vertex from share ${vertex.getId()}@${vertex.getFeed()}: ${(<Error>err).message}`)
        }
      }
    }

    return vertices
  }

  // within a query getting the PSV actually returns the one on the referred edge
  public async get(
    edge: Edge & { feed: Buffer; metadata?: { refKey: Buffer; refLabel: Buffer } },
    state: QueryState<GraphObject>
  ): Promise<QueryResult<GraphObject>> {
    const feed = edge.feed.toString('hex')

    if (!edge.metadata || !Buffer.isBuffer(edge.metadata.refKey) || !Buffer.isBuffer(edge.metadata.refLabel) || edge.metadata.refLabel.length === 0) {
      throw new Error('ReferrerView.get requires metadata.refKey and .refLabel to be set')
    }

    const tr = await this.getTransaction(feed)
    const vertex = await this.db.getInTransaction<GraphObject>(edge.ref, this.codec, tr, feed)
    const edges = vertex.getEdges(edge.metadata.refLabel.toString('base64'))
    if (edges.length === 0) {
      debug(`ReferrerView: empty pre-shared vertex: ${vertex.getId()}@${vertex.getFeed()}`)
      return []
    }

    const ref = {
      feed: edges[0].feed?.toString('hex') || feed,
      version: edges[0].version,
      view: edges[0].view || GRAPH_VIEW,
      id: edges[0].ref,
      label: edge.metadata.refLabel.toString('base64')
    }

    this.crypto.registerKey(edge.metadata.refKey, { feed: ref.feed, index: ref.id, type: Cipher.ChaCha20_Stream })

    const view = this.getView(ref.view)
    const nextStates = await view
      .query(Generator.from([state.mergeStates(vertex, state.path, state.rules, state.view)]))
      .out(ref.label)
      .states()
    if (nextStates.length === 0) throw new Error('vertex has no share edge, cannot use ShareView')
    return nextStates.map(async (next) => {
      const mergedState = next.mergeStates(next.value, state.path.concat(next.path.slice(1)), state.rules, next.view)
      return this.toResult(next.value, edge, mergedState)
    })
  }
}
