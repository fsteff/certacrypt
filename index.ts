import { ICrypto } from "certacrypt-crypto";
import { CertaCryptGraph } from "certacrypt-graph";
import { Core, Corestore, SimpleGraphObject, Vertex } from "hyper-graphdb";
import { parseUrl } from './lib/url'


export class CertaCrypt{
    readonly corestore: Corestore
    readonly crypto: ICrypto
    readonly graph: CertaCryptGraph
    
    private sessionRoot?: Vertex<SimpleGraphObject>
    
    constructor(corestore: Corestore, crypto: ICrypto, sessionUrl?: string) {
        this.graph = new CertaCryptGraph(corestore, null, crypto)
    }
}