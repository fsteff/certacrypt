import { Corestore, Vertex, GraphObject } from 'hyper-graphdb'
import { ICrypto, Primitives } from 'certacrypt-crypto'
import { CertaCryptGraph } from 'certacrypt-graph'
import wrapHypercore from './js/cryptoCore'
import HyperBee from 'hyperbee'

export class CacheDB {
  readonly db: HyperBee

  constructor(corestore: Corestore, graph: CertaCryptGraph, sessionRoot: Vertex<GraphObject>) {
    const seed = Primitives.hash(Buffer.concat([Buffer.from(sessionRoot.getFeed(), 'hex'), Buffer.from([sessionRoot.getId()])]))
    const secret = Primitives.hash(Buffer.concat([graph.getKey(sessionRoot), seed]))
    const namespace = corestore.namespace(seed.toString('hex'))
    const feed = wrapHypercore(namespace.default(), encrypt, decrypt)
    this.db = new HyperBee(feed, { keyEncoding: 'utf-8', valueEncoding: 'json' })

    function encrypt(data: Buffer, index: number): Buffer {
      return Primitives.encryptBlockStream(data, index, secret)
    }

    function decrypt(data: Buffer, index: number): Buffer {
      return Primitives.decryptBlockStream(data, index, secret)
    }
  }

  get<T>(key: string): Promise<T | null> {
    return this.db.get(key).then((result) => result.value)
  }

  put<T>(key: string, value?: T): Promise<void> {
    return this.db.put(key, value)
  }

  del(key: string): Promise<void> {
    return this.db.del(key)
  }
}
