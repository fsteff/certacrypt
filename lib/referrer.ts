import { Cipher, ICrypto } from 'certacrypt-crypto'
import { CryptoCore } from 'certacrypt-graph'
import { Edge, Generator, GraphObject, GRAPH_VIEW, IVertex, QueryResult, QueryState, Vertex, View, ViewGetResult } from 'hyper-graphdb'
import { PreSharedGraphObject } from './graphObjects'

export const REFERRER_VIEW = 'ReferrerView'

export interface ReferrerEdge extends Edge {
  view: string
  metadata: {
    key: Buffer
    refKey: Buffer
    refLabel: Buffer
  }
}

export class ReferrerView extends View<GraphObject> {
  public viewName = REFERRER_VIEW
  private crypto: ICrypto
  private user?: string

  constructor(db: CryptoCore, contentEncoding, factory, transactions?) {
    super(db, contentEncoding, factory, transactions)
    this.crypto = db.crypto
  }

  filterUser(user: string) {
    this.user = user
    return this
  }

  public async out(state: QueryState<PreSharedGraphObject>, label?: string):  Promise<QueryResult<GraphObject>> {
    const vertex = <Vertex<PreSharedGraphObject>> state.value
    if (!(vertex.getContent() instanceof PreSharedGraphObject)) {
      throw new Error('Vertex is not a a physical one, cannot use it for a PreSharedVertexView')
    }

    if(this.user) {
      // if filter mode is set, only apply referrers of this user
      const owner = vertex.getContent()?.owner
      if(owner !== this.user) {
        return []
      }
    }

    const edges = vertex.getEdges(label)
    const vertices: QueryResult<GraphObject> = []
    for (const edge of edges) {
      const feed = edge.feed || Buffer.from(<string>vertex.getFeed(), 'hex')
      const meta = <{ refKey: Buffer; refLabel: Buffer }>edge.metadata
      if (meta.refKey && meta.refLabel) {
        vertices.push(this.get({...edge, feed, metadata: meta}, state))
      }
    }

    return vertices
  }

  // within a query getting the PSV actually returns the one on the referred edge
  public async get(edge: Edge & {feed: Buffer, metadata?: {refKey: Buffer, refLabel: Buffer}}, state: QueryState<GraphObject>): ViewGetResult<GraphObject> {
    const feed = edge.feed.toString('hex')

    if (!edge.metadata || !Buffer.isBuffer(edge.metadata.refKey) || !Buffer.isBuffer(edge.metadata.refLabel) || edge.metadata.refLabel.length === 0) {
      throw new Error('PreSharedVertexView.get requires metadata.refKey and .refLabel to be set')
    }

    const tr = await this.getTransaction(feed)
    const vertex = await this.db.getInTransaction<GraphObject>(edge.ref, this.codec, tr, feed)
    const edges = vertex.getEdges(edge.metadata.refLabel.toString('base64'))
    if (edges.length === 0) return Promise.reject('empty pre-shared vertex')

    const ref = {
      feed: edges[0].feed?.toString('hex') || feed,
      version: edges[0].version,
      view: edges[0].view || GRAPH_VIEW,
      id: edges[0].ref,
      label: edge.metadata.refLabel.toString('base64')
    }

    this.crypto.registerKey(edge.metadata.refKey, { feed: ref.feed, index: ref.id, type: Cipher.ChaCha20_Stream })

    const view = this.getView(ref.view)
    const next = await view.query(Generator.from([new QueryState<GraphObject>(vertex, [], [], view)])).out(ref.label).vertices()
    if (next.length === 0) throw new Error('vertex has no share edge, cannot use ShareView')
    return this.toResult(next[0], edge, state)
  }
}
