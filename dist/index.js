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
exports.CertaCrypt = exports.Space = exports.DriveShare = exports.CommShare = exports.FriendState = exports.ContactProfile = exports.Contacts = exports.Inbox = exports.User = exports.URL_TYPES = exports.parseUrl = exports.createUrl = exports.enableDebugLogging = exports.ShareGraphObject = exports.GraphObjects = void 0;
const certacrypt_crypto_1 = require("certacrypt-crypto");
const certacrypt_graph_1 = require("certacrypt-graph");
const certacrypt_graph_2 = require("certacrypt-graph");
Object.defineProperty(exports, "ShareGraphObject", { enumerable: true, get: function () { return certacrypt_graph_2.ShareGraphObject; } });
const hyper_graphdb_1 = require("hyper-graphdb");
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
Object.defineProperty(exports, "FriendState", { enumerable: true, get: function () { return contacts_1.FriendState; } });
Object.defineProperty(exports, "Contacts", { enumerable: true, get: function () { return contacts_1.Contacts; } });
Object.defineProperty(exports, "ContactProfile", { enumerable: true, get: function () { return contacts_1.ContactProfile; } });
const communication_1 = require("./lib/communication");
Object.defineProperty(exports, "CommShare", { enumerable: true, get: function () { return communication_1.CommShare; } });
const DriveShare = __importStar(require("./lib/driveshares"));
exports.DriveShare = DriveShare;
const Space = __importStar(require("./lib/space"));
exports.Space = Space;
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
            this.sessionRoot
                .then(async (root) => {
                const secret = await this.path(user_1.USER_PATHS.IDENTITY_SECRET);
                const publicRoot = await this.path(user_1.USER_PATHS.PUBLIC);
                const user = new user_1.User(publicRoot, this.graph, secret);
                resolveUser(user);
                const socialRoot = await this.path(communication_1.COMM_PATHS.SOCIAL);
                resolveSocialRoot(socialRoot);
            })
                .catch(console.error);
        }
        else {
            this.graph = new certacrypt_graph_1.CertaCryptGraph(corestore, undefined, crypto);
            this.initSession()
                .then(({ root, user, commRoot: socialRoot }) => {
                resolveRoot(root);
                resolveUser(user);
                resolveSocialRoot(socialRoot);
            })
                .catch(console.error);
        }
        this.cacheDb = new Promise(async (resolve) => {
            const root = await this.sessionRoot;
            const cache = new cacheDB_1.CacheDB(this.corestore, this.graph, root);
            const user = await this.user;
            const socialRoot = await this.socialRoot;
            this.graph.factory.register(contacts_1.CONTACTS_VIEW, (_, codec, tr) => new contacts_1.ContactsView(cache, this.graph, user, codec, this.graph.factory, tr));
            this.graph.factory.register(communication_1.COMM_VIEW, (_, codec, tr) => new communication_1.CommunicationView(cache, this.graph, user, codec, this.graph.factory, tr));
            this.graph.factory.register(DriveShare.DRIVE_SHARE_VIEW, (_, codec, tr) => new DriveShare.DriveShareView(cache, this.graph, socialRoot, codec, this.graph.factory, tr));
            this.graph.factory.register(Space.SPACE_VIEW, (_, codec, tr) => new Space.CollaborationSpaceView(user, this.graph, codec, this.graph.factory, tr));
            resolve(cache);
        });
        this.contacts = Promise.all([this.socialRoot, this.user, this.cacheDb]).then(async ([socialRoot, user, cacheDb]) => {
            const contacts = new contacts_1.Contacts(this.graph, socialRoot, user, cacheDb);
            await contacts.friends;
            return contacts;
        });
        this.tmp = this.path('tmp')
            .catch(async () => {
            const root = await this.sessionRoot;
            const dir = this.graph.create();
            dir.setContent(new GraphObjects.Directory());
            await this.graph.put(dir);
            root.addEdgeTo(dir, 'tmp');
            await this.graph.put(root);
            return dir;
        })
            .then(async (tmp) => {
            return {
                rootDir: tmp,
                drive: await drive_1.cryptoDrive(this.corestore, this.graph, this.crypto, tmp)
            };
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
        const shares = this.graph.create();
        const commRoot = this.graph.create();
        const tmp = this.graph.create();
        tmp.setContent(new GraphObjects.Directory());
        await this.graph.put([root, apps, shares, commRoot, tmp]);
        root.addEdgeTo(apps, 'apps');
        root.addEdgeTo(tmp, 'tmp');
        root.addEdgeTo(shares, 'shares');
        root.addEdgeTo(commRoot, communication_1.COMM_PATHS.SOCIAL);
        root.addEdgeTo(commRoot, 'contacts', { view: contacts_1.CONTACTS_VIEW });
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
                throw new Error('path does not exist: ' + path);
            else
                throw new Error('path query requires unique results: ' + path);
        });
    }
    async createShare(vertex, reuseIfExists = true) {
        var _a;
        const shares = await this.path('/shares');
        let shareVertex;
        if (reuseIfExists) {
            // checks if exists + loads the keys into the crypto key store
            const view = this.graph.factory.get(hyper_graphdb_1.STATIC_VIEW);
            const matching = await view
                .query(hyper_graphdb_1.Generator.from([new hyper_graphdb_1.QueryState(shares, [], [], view)]))
                .out('url', view)
                .generator()
                .filter(async (share) => {
                const target = await view
                    .query(hyper_graphdb_1.Generator.from([new hyper_graphdb_1.QueryState(share, [], [], view)]))
                    .out('share')
                    .matches((v) => v.equals(vertex))
                    .generator()
                    .destruct();
                return target.length > 0;
            })
                .destruct();
            if (matching.length > 0) {
                shareVertex = matching[0];
            }
        }
        if (!shareVertex) {
            let shareView = hyper_graphdb_1.GRAPH_VIEW;
            if (((_a = vertex.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === GraphObjects.GraphObjectTypeNames.SPACE) {
                shareView = Space.SPACE_VIEW;
            }
            shareVertex = await this.graph.createShare(vertex, { info: 'share by URL', owner: (await this.user).getPublicUrl(), view: shareView });
            shares.addEdgeTo(shareVertex, 'url', { view: certacrypt_graph_2.SHARE_VIEW });
            await this.graph.put(shares);
            debug_1.debug(`created share to vertex ${vertex.getFeed()}/${vertex.getId()} at ${shareVertex.getFeed()}/${shareVertex.getId()}`);
        }
        return shareVertex;
    }
    async mountShare(target, label, url) {
        const { feed, id, key } = url_1.parseUrl(url);
        const vertex = await this.graph.get(id, feed, key);
        target.addEdgeTo(vertex, label, { view: certacrypt_graph_2.SHARE_VIEW });
        await this.graph.put(target);
        debug_1.debug(`mounted share from URL ${url} to ${target.getFeed()}/${target.getId()}->${label}`);
        debug_1.debug(await this.debugDrawGraph());
    }
    getFileUrl(vertex, name) {
        return url_1.createUrl(vertex, this.graph.getKey(vertex), vertex.getVersion(), url_1.URL_TYPES.FILE, name);
    }
    async getFileByUrl(url) {
        const { feed, id, key, name, version } = url_1.parseUrl(url);
        this.crypto.registerKey(key, { feed, index: id, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
        const tmp = await this.tmp;
        const vertex = await this.graph.core.get(feed, id, this.graph.codec, version);
        const label = encodeURIComponent(url);
        if (tmp.rootDir.getEdges(label).length === 0) {
            tmp.rootDir.addEdgeTo(vertex, label);
            await this.graph.put(tmp.rootDir);
        }
        return { vertex, name, stat, readFile };
        async function stat() {
            return tmp.drive.promises.lstat(label, { db: { encrypted: true } });
        }
        async function readFile(opts) {
            return tmp.drive.promises.readFile(label, opts);
        }
    }
    async sendShare(share, recipients) {
        for (const user of recipients) {
            const comm = await communication_1.Communication.GetOrInitUserCommunication(this.graph, await this.socialRoot, await this.cacheDb, await this.user, user);
            await comm.sendShare(share);
        }
    }
    async drive(rootDir) {
        if (typeof rootDir === 'string') {
            const { feed, id, key } = url_1.parseUrl(rootDir);
            const vertex = await this.graph.get(id, feed, key);
            rootDir = vertex;
            debug_1.debug(await this.debugDrawGraph(rootDir));
        }
        return drive_1.cryptoDrive(this.corestore, this.graph, this.crypto, rootDir);
    }
    async getUserByUrl(url) {
        const { feed, id, key } = url_1.parseUrl(url);
        const root = await this.graph.get(id, feed, key);
        return new user_1.User(root, this.graph);
    }
    async convertToCollaborationSpace(parent, directory) {
        return Space.CollaborationSpace.CreateSpace(this.graph, await this.user, parent, directory);
    }
    async debugDrawGraph(root, currentDepth = 0, label = '/', visited = new Set(), view) {
        var _a, _b;
        root = root || (await this.sessionRoot);
        let graph = '';
        let type = ((_a = root.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) || 'GraphObject';
        let viewStr = !!view ? ' - View: ' + view : '';
        for (let i = 0; i < currentDepth; i++)
            graph += ' |';
        graph += ` ${label} <${type}> [${root.getId()}] @ ${root.getFeed()}${viewStr}\n`;
        const id = root.getId() + '@' + root.getFeed();
        if (visited.has(id))
            return graph;
        visited.add(id);
        for (const edge of root.getEdges()) {
            try {
                const next = await this.graph.get(edge.ref, edge.feed || root.getFeed(), edge.metadata.key);
                graph += await this.debugDrawGraph(next, currentDepth + 1, edge.label, visited, edge.view);
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