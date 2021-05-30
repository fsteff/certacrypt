"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertaCrypt = exports.parseUrl = exports.createUrl = exports.enableDebugLogging = exports.ShareGraphObject = exports.File = exports.Directory = void 0;
const certacrypt_graph_1 = require("certacrypt-graph");
const certacrypt_graph_2 = require("certacrypt-graph");
Object.defineProperty(exports, "ShareGraphObject", { enumerable: true, get: function () { return certacrypt_graph_2.ShareGraphObject; } });
const graphObjects_1 = require("./lib/graphObjects");
Object.defineProperty(exports, "Directory", { enumerable: true, get: function () { return graphObjects_1.Directory; } });
Object.defineProperty(exports, "File", { enumerable: true, get: function () { return graphObjects_1.File; } });
const url_1 = require("./lib/url");
Object.defineProperty(exports, "parseUrl", { enumerable: true, get: function () { return url_1.parseUrl; } });
Object.defineProperty(exports, "createUrl", { enumerable: true, get: function () { return url_1.createUrl; } });
const drive_1 = require("./lib/drive");
const debug_1 = require("./lib/debug");
Object.defineProperty(exports, "enableDebugLogging", { enumerable: true, get: function () { return debug_1.enableDebugLogging; } });
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
        this.graph.codec.registerImpl((data) => new graphObjects_1.File(data));
        this.graph.codec.registerImpl((data) => new graphObjects_1.Directory(data));
        this.graph.codec.registerImpl((data) => new graphObjects_1.Thombstone(data));
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
        debug_1.debug(`initialized session ${url_1.createUrl(root, this.graph.getKey(root))}`);
        return root;
    }
    async getSessionUrl() {
        const root = await this.sessionRoot;
        return url_1.createUrl(root, this.graph.getKey(root));
    }
    async path(path) {
        return this.graph
            .queryPathAtVertex(path, await this.sessionRoot)
            .vertices()
            .then((res) => {
            if (res.length === 1)
                return res[0];
            else if (res.length === 0)
                throw new Error('path does not exist');
            else
                throw new Error('path query requires unique results');
        });
    }
    async share(vertex, reuseIfExists = true) {
        const shares = await this.path('/shares');
        let shareVertex;
        if (reuseIfExists) {
            // checks if exists + loads the keys into the crypto key store
            const existing = await this.graph
                .queryAtVertex(await this.sessionRoot)
                .out('shares')
                .out('url')
                .matches((v) => v.equals(vertex))
                .vertices();
            if (existing.length > 0) {
                const edges = shares.getEdges('url').filter((e) => { var _a; return e.ref === vertex.getId() && (((_a = e.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) || shares.getFeed()) === vertex.getFeed(); });
                if (edges.length > 0)
                    shareVertex = await this.graph.get(edges[0].ref, edges[0].feed || shares.getFeed());
            }
        }
        if (!shareVertex) {
            shareVertex = this.graph.create();
            const content = new certacrypt_graph_2.ShareGraphObject();
            content.info = 'share by URL';
            shareVertex.setContent(content);
            shareVertex.addEdgeTo(vertex, 'share');
            await this.graph.put(shareVertex);
            shares.addEdgeTo(shareVertex, 'url', undefined, undefined, certacrypt_graph_2.SHARE_VIEW);
            await this.graph.put(shares);
            debug_1.debug(`created share to vertex ${vertex.getFeed()}/${vertex.getId()} at ${shareVertex.getFeed()}/${shareVertex.getId()}`);
        }
        return shareVertex;
    }
    async mountShare(target, label, url) {
        const { feed, id, key } = url_1.parseUrl(url);
        const vertex = await this.graph.get(id, feed, key);
        target.addEdgeTo(vertex, label, undefined, undefined, certacrypt_graph_2.SHARE_VIEW);
        await this.graph.put(target);
        debug_1.debug(`mounted share from URL ${url} to ${target.getFeed()}/${target.getId()}->${label}`);
        debug_1.debug(await this.debugDrawGraph());
    }
    async drive(rootDir) {
        return drive_1.cryptoDrive(this.corestore, this.graph, this.crypto, rootDir);
    }
    async debugDrawGraph(root, currentDepth = 0, label = '/', visited = new Set()) {
        var _a, _b;
        root = root || (await this.sessionRoot);
        let graph = '';
        let type = ((_a = root.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) || 'GraphObject';
        for (let i = 0; i < currentDepth; i++)
            graph += ' |';
        graph += ` ${label} <${type}> [${root.getId()}] @ ${root.getFeed()}\n`;
        const id = root.getId() + '@' + root.getFeed();
        if (visited.has(id))
            return graph;
        visited.add(id);
        for (const edge of root.getEdges()) {
            try {
                const next = await this.graph.get(edge.ref, edge.feed || root.getFeed(), edge.metadata.key);
                graph += await this.debugDrawGraph(next, currentDepth + 1, edge.label, visited);
            }
            catch (err) {
                graph += err + '\nat ' + edge.ref + '@' + ((_b = edge.feed) === null || _b === void 0 ? void 0 : _b.toString('hex')) + '\n';
            }
        }
        return graph;
    }
}
exports.CertaCrypt = CertaCrypt;
//# sourceMappingURL=index.js.map