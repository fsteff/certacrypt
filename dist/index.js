"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertaCrypt = exports.ContactProfile = exports.Contacts = exports.Inbox = exports.User = exports.URL_TYPES = exports.parseUrl = exports.createUrl = exports.enableDebugLogging = exports.ShareGraphObject = exports.GraphObjects = void 0;
const certacrypt_graph_1 = require("certacrypt-graph");
const certacrypt_graph_2 = require("certacrypt-graph");
Object.defineProperty(exports, "ShareGraphObject", { enumerable: true, get: function () { return certacrypt_graph_2.ShareGraphObject; } });
const GraphObjects = __importStar(require("./lib/graphObjects"));
exports.GraphObjects = GraphObjects;
const url_1 = require("./lib/url");
Object.defineProperty(exports, "parseUrl", { enumerable: true, get: function () { return url_1.parseUrl; } });
Object.defineProperty(exports, "createUrl", { enumerable: true, get: function () { return url_1.createUrl; } });
Object.defineProperty(exports, "URL_TYPES", { enumerable: true, get: function () { return url_1.URL_TYPES; } });
const drive_1 = require("./lib/drive");
const debug_1 = require("./lib/debug");
Object.defineProperty(exports, "enableDebugLogging", { enumerable: true, get: function () { return debug_1.enableDebugLogging; } });
const referrer_1 = require("./lib/referrer");
const user_1 = require("./lib/user");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return user_1.User; } });
const inbox_1 = require("./lib/inbox");
Object.defineProperty(exports, "Inbox", { enumerable: true, get: function () { return inbox_1.Inbox; } });
const cacheDB_1 = require("./lib/cacheDB");
const contacts_1 = require("./lib/contacts");
Object.defineProperty(exports, "Contacts", { enumerable: true, get: function () { return contacts_1.Contacts; } });
Object.defineProperty(exports, "ContactProfile", { enumerable: true, get: function () { return contacts_1.ContactProfile; } });
const communication_1 = require("./lib/communication");
class CertaCrypt {
    constructor(corestore, crypto, sessionUrl) {
        var _a;
        this.corestore = corestore;
        this.crypto = crypto;
        let resolveRoot, resolveUser, resolveSocialRoot;
        this.sessionRoot = new Promise((resolve, _) => {
            resolveRoot = resolve;
        });
        this.user = new Promise((resolve, _) => {
            resolveUser = resolve;
        });
        this.socialRoot = new Promise((resolve, _) => {
            resolveSocialRoot = resolve;
        });
        if (sessionUrl) {
            const { feed, id, key } = url_1.parseUrl(sessionUrl);
            this.graph = new certacrypt_graph_1.CertaCryptGraph(corestore, feed, crypto);
            this.graph.get(id, feed, key).then(resolveRoot);
            this.sessionRoot.then(async (root) => {
                const secret = await this.path(user_1.USER_PATHS.IDENTITY_SECRET);
                const publicRoot = await this.path(user_1.USER_PATHS.PUBLIC);
                const user = new user_1.User(publicRoot, this.graph, secret);
                resolveUser(user);
                const socialRoot = await this.path(communication_1.COMM_PATHS.SOCIAL);
                resolveSocialRoot(socialRoot);
            });
        }
        else {
            this.graph = new certacrypt_graph_1.CertaCryptGraph(corestore, undefined, crypto);
            this.initSession().then(({ root, user, commRoot: socialRoot }) => {
                resolveRoot(root);
                resolveUser(user);
                resolveSocialRoot(socialRoot);
            });
        }
        this.cacheDb = new Promise(async (resolve) => {
            const root = await this.sessionRoot;
            const cache = new cacheDB_1.CacheDB(this.corestore, this.graph, root);
            const user = await this.user;
            this.graph.factory.register(contacts_1.CONTACTS_VIEW, (_, codec, tr) => new contacts_1.ContactsView(cache, this.graph, user, codec, this.graph.factory, tr));
            resolve(cache);
        });
        this.contacts = Promise.all([this.socialRoot, this.user, this.cacheDb])
            .then(async ([socialRoot, user, cacheDb]) => {
            const contacts = new contacts_1.Contacts(this.graph, socialRoot, user, cacheDb);
            await contacts.friends;
            return contacts;
        });
        for (const key in GraphObjects) {
            const Constr = getConstructor(GraphObjects[key]);
            if (Constr) {
                this.graph.codec.registerImpl(Constr);
                debug_1.debug('Registered GraphObject ' + ((_a = GraphObjects[key]) === null || _a === void 0 ? void 0 : _a.name));
            }
        }
        this.graph.factory.register(referrer_1.REFERRER_VIEW, (db, codec, tr) => new referrer_1.ReferrerView(db, codec, this.graph.factory, tr));
    }
    async initSession() {
        const root = this.graph.create();
        const apps = this.graph.create();
        //const contacts = this.graph.create<SimpleGraphObject>()
        const shares = this.graph.create();
        const commRoot = this.graph.create();
        await this.graph.put([root, apps, shares, commRoot]);
        root.addEdgeTo(apps, 'apps');
        //root.addEdgeTo(contacts, 'contacts')
        root.addEdgeTo(shares, 'shares');
        root.addEdgeTo(commRoot, communication_1.COMM_PATHS.SOCIAL);
        root.addEdgeTo(commRoot, 'contacts', undefined, undefined, contacts_1.CONTACTS_VIEW);
        await this.graph.put(root);
        const user = await user_1.User.InitUser(this.graph, root);
        debug_1.debug(`initialized session ${url_1.createUrl(root, this.graph.getKey(root))}`);
        return { root, user, commRoot };
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
        if (typeof rootDir === 'string') {
            const { feed, id, key } = url_1.parseUrl(rootDir);
            const vertex = await this.graph.get(id, feed, key);
            rootDir = vertex;
            /*if(vertex.getContent()?.typeName === SHARE_GRAPHOBJECT) {
              const dir = await this.graph.queryAtVertex(vertex).out().vertices()
              if(dir.length !== 1 || dir[0].getContent()?.typeName !== GraphObjects.GraphObjectTypeNames.DIRECTORY) {
                throw new Error('expected exactly one shared directory, got ' + dir.map(v => v.getContent()?.typeName))
              }
              rootDir = <Vertex<GraphObjects.Directory>> dir[0]
            } else if (vertex.getContent()?.typeName === GraphObjects.GraphObjectTypeNames.DIRECTORY) {
              rootDir = <Vertex<GraphObjects.Directory>> vertex
            } else {
              throw new Error('expected a directory from the passed drive url, got ' + vertex.getContent()?.typeName)
            }*/
            debug_1.debug(await this.debugDrawGraph(rootDir));
        }
        return drive_1.cryptoDrive(this.corestore, this.graph, this.crypto, rootDir);
    }
    async getUserByUrl(url) {
        const { feed, id, key } = url_1.parseUrl(url);
        const root = await this.graph.get(id, feed, key);
        return new user_1.User(root, this.graph);
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
function getConstructor(f) {
    var _a;
    if (!((_a = f === null || f === void 0 ? void 0 : f.constructor) === null || _a === void 0 ? void 0 : _a.name))
        return;
    try {
        const inst = new f();
        return (...args) => new f(...args);
    }
    catch (_b) {
        // return undefined
    }
}
//# sourceMappingURL=index.js.map