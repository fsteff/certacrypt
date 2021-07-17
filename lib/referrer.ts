import { Cipher, ICrypto } from 'certacrypt-crypto'
import { CryptoCore } from 'certacrypt-graph'
import { Edge, Generator, GraphObject, GRAPH_VIEW, IVertex, Vertex, VertexQueries, View } from 'hyper-graphdb'
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

  constructor(db: CryptoCore, contentEncoding, factory, transactions?) {
    super(db, contentEncoding, factory, transactions)
    this.crypto = db.crypto
  }

  public async out(vertex: Vertex<PreSharedGraphObject>, label?: string): Promise<VertexQueries<GraphObject>> {
    if (!(vertex.getContent() instanceof PreSharedGraphObject)) {
      throw new Error('Vertex is not a a physical one, cannot use it for a PreSharedVertexView')
    }
    const edges = vertex.getEdges(label)
    const vertices = new Array<Promise<IVertex<GraphObject>>>()
    for (const edge of edges) {
      const feed = edge.feed?.toString('hex') || <string>vertex.getFeed()
      const meta = <{ refKey: Buffer; refLabel: Buffer }>edge.metadata
      if (meta.refKey && meta.refLabel) {
        vertices.push(this.get(feed, edge.ref, undefined, edge.view, meta))
      }
    }

    return Generator.from(vertices)
  }

  // within a query getting the PSV actually returns the one on the referred edge
  public async get(
    feed: string | Buffer,
    id: number,
    version?: number,
    _?: string,
    metadata?: { refKey: Buffer; refLabel: Buffer }
  ): Promise<IVertex<GraphObject>> {
    feed = Buffer.isBuffer(feed) ? feed.toString('hex') : feed

    if (!metadata || !Buffer.isBuffer(metadata.refKey) || !Buffer.isBuffer(metadata.refLabel) || metadata.refLabel.length === 0) {
      throw new Error('PreSharedVertexView.get requires metadata.refKey and .refLabel to be set')
    }

    const tr = await this.getTransaction(feed, version)
    const vertex = await this.db.getInTransaction<GraphObject>(id, this.codec, tr, feed)
    const edges = vertex.getEdges(metadata.refLabel.toString('base64'))
    if (edges.length === 0) return Promise.reject('empty pre-shared vertex')

    const ref = {
      feed: edges[0].feed?.toString('hex') || feed,
      version: edges[0].version,
      view: edges[0].view || GRAPH_VIEW,
      id: edges[0].ref,
      label: metadata.refLabel.toString('base64')
    }

    this.crypto.registerKey(metadata.refKey, { feed: ref.feed, index: ref.id, type: Cipher.ChaCha20_Stream })

    const view = this.getView(ref.view)
    const next = await (await view.out(vertex, ref.label)).destruct()
    if (next.length === 0) throw new Error('vertex has no share edge, cannot use ShareView')
    return next[0]
  }
}
