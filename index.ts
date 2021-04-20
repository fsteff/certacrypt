import { Cipher, ICrypto } from "certacrypt-crypto";
import { CertaCryptGraph } from "certacrypt-graph";
import { Core, Corestore, GraphObject, SimpleGraphObject, Vertex } from "hyper-graphdb";
import { parseUrl, createUrl } from './lib/url'


export class CertaCrypt{
    readonly corestore: Corestore
    readonly crypto: ICrypto
    readonly graph: CertaCryptGraph
    
    private sessionRoot: Promise<Vertex<GraphObject>>
    
    constructor(corestore: Corestore, crypto: ICrypto, sessionUrl?: string) {
        this.corestore = corestore
        this.crypto = crypto
        
        if(sessionUrl) {
            const {feed, id, key} = parseUrl(sessionUrl)
            this.graph = new CertaCryptGraph(corestore, feed, crypto)
            this.sessionRoot = this.graph.get(id, feed, key)
        } else {
            this.graph = new CertaCryptGraph(corestore, undefined, crypto)
            this.sessionRoot = this.initSession()
        } 
    }

    private async initSession() {
       const root = this.graph.create<SimpleGraphObject>()
       const pub = this.graph.create<SimpleGraphObject>()
       const apps = this.graph.create<SimpleGraphObject>()
       const contacts = this.graph.create<SimpleGraphObject>()
       const shares = this.graph.create<SimpleGraphObject>()
       await this.graph.put([root, pub, apps, contacts, shares])

       root.addEdgeTo(pub, 'public')
       root.addEdgeTo(apps, 'apps')
       root.addEdgeTo(contacts, 'contacts')
       root.addEdgeTo(shares, 'shares')
       await this.graph.put(root)

       return root
    }

    public async getSessionUrl() {
        const root = await this.sessionRoot
        return createUrl(root, this.graph.getKey(root))
    }

    public async path(path: string){
        return this.graph.queryPathAtVertex(path, await this.sessionRoot).vertices()
            .then(res => {
                if(res.length === 1) return res[0]
                else throw new Error('path query requires unique results')
            })
    }

    public async share(vertex: Vertex<GraphObject>) {
        const shares = this.path('/shares')

    }
}