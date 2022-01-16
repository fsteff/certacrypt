import { Corestore, Vertex, GraphObject } from '@certacrypt/hyper-graphdb'
import { ICrypto, Primitives } from '@certacrypt/certacrypt-crypto'
import { CertaCryptGraph } from '@certacrypt/certacrypt-graph'
import wrapHypercore from './js/cryptoCore'
import HyperTrie from 'hypertrie'

export class CacheDB {
  readonly db: HyperTrie

  constructor(corestore: Corestore, graph: CertaCryptGraph, sessionRoot: Vertex<GraphObject>) {
    const seed = Primitives.hash(Buffer.concat([Buffer.from(sessionRoot.getFeed(), 'hex'), Buffer.from([sessionRoot.getId()])]))
    const secret = Primitives.hash(Buffer.concat([graph.getKey(sessionRoot), seed]))
    const namespace = corestore.namespace(seed.toString('hex'))
    const feed = wrapHypercore(namespace.default(), encrypt, decrypt)
    this.db = new HyperTrie(undefined, { feed, valueEncoding: 'json' })

    function encrypt(data: Buffer, index: number): Buffer {
      return Primitives.encryptBlockStream(data, index, secret)
    }

    function decrypt(data: Buffer, index: number): Buffer {
      return Primitives.decryptBlockStream(data, index, secret)
    }
  }

  get<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => this.db.get(key, (err, result) => (err ? reject(err) : resolve(result?.value))))
  }

  put<T>(key: string, value?: T): Promise<void> {
    return new Promise((resolve, reject) => this.db.put(key, value, (err, result) => (err ? reject(err) : resolve(result))))
  }

  del(key: string): Promise<void> {
    return new Promise((resolve, reject) => this.db.get(key, (err, result) => (err ? reject(err) : resolve(result))))
  }
}
