"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertaCrypt = exports.File = exports.Directory = void 0;
const certacrypt_graph_1 = require("certacrypt-graph");
const certacrypt_graph_2 = require("certacrypt-graph");
const graphObjects_1 = require("./lib/graphObjects");
Object.defineProperty(exports, "Directory", { enumerable: true, get: function () { return graphObjects_1.Directory; } });
Object.defineProperty(exports, "File", { enumerable: true, get: function () { return graphObjects_1.File; } });
const url_1 = require("./lib/url");
const drive_1 = require("./lib/drive");
class CertaCrypt {
    constructor(corestore, crypto, sessionUrl) {
        this.corestore = corestore;
        this.crypto = crypto;
        if (sessionUrl) {
            const { feed, id, key } = url_1.parseUrl(sessionUrl);
            this.graph = new certacrypt_graph_1.CertaCryptGraph(corestore, feed, crypto);
            this.sessionRoot = this.graph.get(id, feed, key);
        }
        else {
            this.graph = new certacrypt_graph_1.CertaCryptGraph(corestore, undefined, crypto);
            this.sessionRoot = this.initSession();
        }
        this.graph.codec.registerImpl(data => new graphObjects_1.File(data));
        this.graph.codec.registerImpl(data => new graphObjects_1.Directory(data));
    }
    async initSession() {
        const root = this.graph.create();
        const pub = this.graph.create();
        const apps = this.graph.create();
        const contacts = this.graph.create();
        const shares = this.graph.create();
        await this.graph.put([root, pub, apps, contacts, shares]);
        root.addEdgeTo(pub, 'public');
        root.addEdgeTo(apps, 'apps');
        root.addEdgeTo(contacts, 'contacts');
        root.addEdgeTo(shares, 'shares');
        await this.graph.put(root);
        return root;
    }
    async getSessionUrl() {
        const root = await this.sessionRoot;
        return url_1.createUrl(root, this.graph.getKey(root));
    }
    async path(path) {
        return this.graph.queryPathAtVertex(path, await this.sessionRoot).vertices()
            .then(res => {
            if (res.length === 1)
                return res[0];
            else
                throw new Error('path query requires unique results');
        });
    }
    async share(vertex) {
        const shares = await this.path('/shares');
        const created = this.graph.create();
        created.addEdgeTo(vertex, 'share');
        await this.graph.put(created);
        shares.addEdgeTo(created, 'url', undefined, undefined, certacrypt_graph_2.SHARE_VIEW);
        await this.graph.put(shares);
        return created;
    }
    async mountShare(target, label, url) {
        const { feed, id, key } = url_1.parseUrl(url);
        const vertex = await this.graph.get(id, feed, key);
        target.addEdgeTo(vertex, label, undefined, undefined, certacrypt_graph_2.SHARE_VIEW);
        await this.graph.put(target);
    }
    async drive(rootDir) {
        return drive_1.cryptoDrive(this.corestore, this.graph, this.crypto, rootDir);
    }
}
exports.CertaCrypt = CertaCrypt;
//# sourceMappingURL=index.js.map