import { Generator, GraphObject, GRAPH_VIEW, QueryState, STATIC_VIEW, Vertex } from 'hyper-graphdb'
import { CertaCryptGraph, ShareGraphObject, SHARE_VIEW } from 'certacrypt-graph'
import { SPACE_VIEW } from './space'
import { GraphObjectTypeNames } from './graphObjects'

export const SHARE_TYPE_URL = 'url'
export const SHARE_TYPE_USER = 'user'

export class Shares {
  readonly getSharesRoot: () => Promise<Vertex<GraphObject>>

  constructor(readonly graph: CertaCryptGraph, readonly user, sharesRoot: Vertex<GraphObject>) {
    const id = sharesRoot.getId()
    const feed = sharesRoot.getFeed()
    this.getSharesRoot = () => graph.get(id, feed)
  }

  async createShare(vertex: Vertex<GraphObject>, shareByUrl = false) {
    const root = await this.getSharesRoot()
    if (shareByUrl) {
      const shares = await this.findSharesTo(vertex, true)
      if (shares.length > 0) {
        return shares[0]
      }
    }

    let view = GRAPH_VIEW
    const label = shareByUrl ? SHARE_TYPE_URL : SHARE_TYPE_USER
    const info = shareByUrl ? 'share by URL' : 'share with user'
    const owner = this.user.getPublicUrl()
    if (vertex.getContent()?.typeName === GraphObjectTypeNames.SPACE) {
      view = SPACE_VIEW
    }
    const shareVertex = await this.graph.createShare(vertex, { info, owner, view })
    root.addEdgeTo(shareVertex, label, { view: SHARE_VIEW })
    await this.graph.put(root)
    return shareVertex
  }

  async findSharesTo(vertex: Vertex<GraphObject> | Vertex<GraphObject>[], shareByUrl = false) {
    const root = await this.getSharesRoot()
    const view = this.graph.factory.get(STATIC_VIEW)
    const label = shareByUrl ? SHARE_TYPE_URL : undefined
    const matching = <Vertex<ShareGraphObject>[]>await view
      .query(Generator.from([new QueryState(root, [], [], view)]))
      .out(label, view)
      .generator()
      .filter((share) => !(<Vertex<ShareGraphObject>>share).getContent()?.revoked)
      .filter(async (share) => {
        const target = await view
          .query(Generator.from([new QueryState(share, [], [], view)]))
          .out('share')
          .matches((v) => (Array.isArray(vertex) ? vertex.findIndex((other) => v.equals(other)) >= 0 : v.equals(vertex)))
          .generator()
          .destruct()
        return target.length > 0
      })
      .destruct()
    return matching
  }

  async getAllShares(includeRevoked = false) {
    const root = await this.getSharesRoot()
    const view = this.graph.factory.get(STATIC_VIEW)
    const shares = <Vertex<ShareGraphObject>[]>await view
      .query(Generator.from([new QueryState(root, [], [], view)]))
      .out(undefined, view)
      .vertices()
    if (!includeRevoked) {
      return shares.filter((share) => !share.getContent()?.revoked)
    } else {
      return shares
    }
  }
}
