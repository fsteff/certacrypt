"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualCommShareVertex = exports.CommShare = exports.CommunicationView = exports.Communication = exports.COMM_VIEW = exports.COMM_PATHS = void 0;
const certacrypt_graph_1 = require("certacrypt-graph");
const hyper_graphdb_1 = require("hyper-graphdb");
const graphObjects_1 = require("./graphObjects");
const url_1 = require("./url");
const debug_1 = require("./debug");
exports.COMM_PATHS = {
    SOCIAL: 'social',
    SOCIAL_ROOT_TO_CHANNELS: 'channels',
    COMM_TO_RCV_SHARES: 'receivedShares',
    COMM_TO_SENT_SHARES: 'sentShares',
    MSG_REQUESTS: 'requests',
    MSG_PROVISION: 'provision',
    PARTICIPANTS: 'participants'
};
exports.COMM_VIEW = 'CommView';
class Communication {
    constructor(graph, userInit, cache) {
        this.graph = graph;
        this.userInit = userInit;
        this.cache = cache;
    }
    static async InitUserCommunication(graph, socialRoot, cache, user, addressant) {
        var _a, _b;
        const comm = new Communication(graph, message(graph, { userUrl: user.getPublicUrl(), type: 'Init' }), cache);
        await graph.put(comm.userInit);
        let channels;
        const results = await graph.queryPathAtVertex(exports.COMM_PATHS.SOCIAL_ROOT_TO_CHANNELS, socialRoot).vertices();
        if (results.length > 0) {
            channels = results[0];
        }
        else {
            channels = graph.create();
            await graph.put(channels);
            socialRoot.addEdgeTo(channels, exports.COMM_PATHS.SOCIAL_ROOT_TO_CHANNELS);
            await graph.put(socialRoot);
        }
        const label = this.getUserLabel(addressant);
        channels.addEdgeTo(comm.userInit, label);
        await graph.put(channels);
        const mail = await user.getInbox();
        await mail.postEnvelope(comm.userInit, addressant);
        await comm.checkInbox(addressant);
        debug_1.debug('Initialized Communication between ' +
            (((_a = (await user.getProfile())) === null || _a === void 0 ? void 0 : _a.username) || user.getPublicUrl()) +
            ' (current user) and ' +
            (((_b = (await addressant.getProfile())) === null || _b === void 0 ? void 0 : _b.username) || addressant.getPublicUrl()));
        return comm;
    }
    static async GetOrInitUserCommunication(graph, socialRoot, cache, user, addressant) {
        const existing = await graph
            .queryPathAtVertex(exports.COMM_PATHS.SOCIAL_ROOT_TO_CHANNELS + '/' + Communication.getUserLabel(addressant), socialRoot)
            .generator()
            .destruct();
        if (existing.length > 0) {
            const comm = new Communication(graph, existing[0], cache);
            await comm.checkInbox(addressant);
            return comm;
        }
        else {
            return Communication.InitUserCommunication(graph, socialRoot, cache, user, addressant);
        }
    }
    static getUserLabel(user) {
        return user.publicRoot.getId() + '@' + user.publicRoot.getFeed();
    }
    async getParticipants() {
        const prt = await this.graph.queryAtVertex(this.userInit).out(exports.COMM_PATHS.PARTICIPANTS).generator().destruct();
        return prt;
        //return <Promise<Vertex<MsgTypeInit>[]>>this.graph.queryPathAtVertex(COMM_PATHS.PARTICIPANTS, this.userInit).generator().destruct()
    }
    async checkInbox(participant) {
        const mail = await participant.getInbox(true);
        const cachePath = `communication/user/${Communication.getUserLabel(participant)}/inboxLastCheckedVersion}`;
        const lastChecked = await this.cache.get(cachePath);
        const envelopes = await mail.checkEnvelopes(lastChecked);
        await this.cache.put(cachePath, mail.getVersion());
        const added = new Array();
        for (const init of envelopes) {
            const existing = this.userInit.getEdges(exports.COMM_PATHS.PARTICIPANTS).filter((e) => { var _a; return e.ref === init.getId() && ((_a = e.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) === init.getFeed(); });
            if (existing.length === 0) {
                added.push(init);
                this.userInit.addEdgeTo(init, exports.COMM_PATHS.PARTICIPANTS);
            }
        }
        if (added.length > 0) {
            await this.graph.put(this.userInit);
        }
        return added;
    }
    message(value) {
        return message(this.graph, value);
    }
    async sendMessage(message, path) {
        await this.graph.put(message);
        this.userInit.addEdgeTo(message, path);
        await this.graph.put(this.userInit);
    }
    async sendFriendRequest(contacts) {
        const contactsUrl = url_1.createUrl(contacts, this.graph.getKey(contacts), undefined, url_1.URL_TYPES.CONTACTS);
        const request = this.message({ contactsUrl, type: 'FriendRequest' });
        return this.sendMessage(request, exports.COMM_PATHS.MSG_REQUESTS);
    }
    async sendShare(share) {
        const shareUrl = url_1.createUrl(share, this.graph.getKey(share), undefined, url_1.URL_TYPES.SHARE);
        const msg = this.message({ shareUrl, type: 'Share' });
        return this.sendMessage(msg, exports.COMM_PATHS.MSG_PROVISION);
    }
    async getRequests() {
        var e_1, _a;
        const prs = await this.graph.queryAtVertex(this.userInit).out(exports.COMM_PATHS.PARTICIPANTS).generator().destruct();
        const iter = this.graph
            .queryPathAtVertex(exports.COMM_PATHS.PARTICIPANTS + '/' + exports.COMM_PATHS.MSG_REQUESTS, this.userInit)
            .values((v) => v.getContent());
        const results = new Array();
        try {
            for (var iter_1 = __asyncValues(iter), iter_1_1; iter_1_1 = await iter_1.next(), !iter_1_1.done;) {
                const msg = iter_1_1.value;
                if (!['FriendRequest'].includes(msg.type)) {
                    throw new Error('Message is not a request: ' + msg.type);
                }
                results.push(msg);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (iter_1_1 && !iter_1_1.done && (_a = iter_1.return)) await _a.call(iter_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return results;
    }
    async getSentRequests() {
        var e_2, _a;
        const iter = this.graph.queryPathAtVertex(exports.COMM_PATHS.MSG_REQUESTS, this.userInit).values((v) => v.getContent());
        const results = new Array();
        try {
            for (var iter_2 = __asyncValues(iter), iter_2_1; iter_2_1 = await iter_2.next(), !iter_2_1.done;) {
                const msg = iter_2_1.value;
                if (!['FriendRequest'].includes(msg.type)) {
                    throw new Error('Message is not a request: ' + msg.type);
                }
                results.push(msg);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (iter_2_1 && !iter_2_1.done && (_a = iter_2.return)) await _a.call(iter_2);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return results;
    }
    async getProvisions() {
        var e_3, _a;
        const iter = this.graph
            .queryPathAtVertex(exports.COMM_PATHS.PARTICIPANTS + '/' + exports.COMM_PATHS.MSG_PROVISION, this.userInit)
            .values((v) => v.getContent());
        const results = new Array();
        try {
            for (var iter_3 = __asyncValues(iter), iter_3_1; iter_3_1 = await iter_3.next(), !iter_3_1.done;) {
                const msg = iter_3_1.value;
                if (!['Share'].includes(msg.type)) {
                    throw new Error('Message is not a provision: ' + msg.type);
                }
                results.push(msg);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (iter_3_1 && !iter_3_1.done && (_a = iter_3.return)) await _a.call(iter_3);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return results;
    }
    async getSentProvisions() {
        var e_4, _a;
        const iter = this.graph.queryPathAtVertex(exports.COMM_PATHS.MSG_PROVISION, this.userInit).values((v) => v.getContent());
        const results = new Array();
        try {
            for (var iter_4 = __asyncValues(iter), iter_4_1; iter_4_1 = await iter_4.next(), !iter_4_1.done;) {
                const msg = iter_4_1.value;
                if (!['Share'].includes(msg.type)) {
                    throw new Error('Message is not a provision: ' + msg.type);
                }
                results.push(msg);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (iter_4_1 && !iter_4_1.done && (_a = iter_4.return)) await _a.call(iter_4);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return results;
    }
}
exports.Communication = Communication;
function message(graph, value) {
    const vertex = graph.create();
    vertex.setContent(Object.assign(new graphObjects_1.JsonGraphObject(), value));
    return vertex;
}
class CommunicationView extends hyper_graphdb_1.View {
    constructor(cacheDb, graph, user, contentEncoding, factory, transactions) {
        super(graph.core, contentEncoding, factory, transactions);
        this.cacheDb = cacheDb;
        this.graph = graph;
        this.user = user;
        this.viewName = exports.COMM_VIEW;
    }
    async out(vertex, label) {
        var _a;
        if (!(vertex instanceof hyper_graphdb_1.Vertex) || !vertex.getFeed()) {
            throw new Error('ContactsView.out does only accept persisted Vertex instances as input');
        }
        const edges = vertex.getEdges(label);
        let vertices;
        if (label === exports.COMM_PATHS.COMM_TO_RCV_SHARES) {
            return this.getAllReceivedShares(vertex);
        }
        else if (label === exports.COMM_PATHS.COMM_TO_SENT_SHARES) {
            return this.getAllSentShares(vertex);
        }
        else {
            vertices = [];
            for (const edge of edges) {
                const feed = ((_a = edge.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) || vertex.getFeed();
                // TODO: version pinning does not work yet
                vertices.push(this.get(feed, edge.ref, /*edge.version*/ undefined, edge.view, edge.metadata));
            }
        }
        return hyper_graphdb_1.Generator.from(vertices);
    }
    getAllReceivedShares(socialRoot) {
        const self = this;
        const userUrl = this.user.getPublicUrl();
        const shares = this.query(hyper_graphdb_1.Generator.from([socialRoot]))
            .out(exports.COMM_PATHS.SOCIAL_ROOT_TO_CHANNELS)
            .out()
            .generator()
            .map((init) => new Communication(this.graph, init, this.cacheDb))
            .map(async (comm) => {
            const sharedBy = (await comm.getParticipants()).map((p) => { var _a; return (_a = p.getContent()) === null || _a === void 0 ? void 0 : _a.userUrl; });
            const provisions = await comm.getProvisions();
            return provisions.map((p) => {
                return { msg: p, sharedBy: sharedBy.length > 0 ? sharedBy[0] : undefined };
            });
        })
            .flatMap((msgs) => hyper_graphdb_1.Generator.from(msgs.map(getShare)));
        return shares;
        async function getShare(result) {
            var _a, _b;
            const parsed = url_1.parseUrl(result.msg.shareUrl);
            if (parsed.type && parsed.type !== url_1.URL_TYPES.SHARE) {
                throw new Error('URL does not have type share: ' + result.msg.shareUrl);
            }
            self.graph.registerVertexKey(parsed.id, parsed.feed, parsed.key);
            const shareVertex = await self.get(parsed.feed, parsed.id, undefined, hyper_graphdb_1.GRAPH_VIEW);
            if (((_a = shareVertex.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) !== certacrypt_graph_1.SHARE_GRAPHOBJECT || shareVertex.getEdges().length !== 1) {
                throw new Error('invalid share vertex: type=' + ((_b = shareVertex.getContent()) === null || _b === void 0 ? void 0 : _b.typeName) + ' #edges=' + shareVertex.getEdges().length);
            }
            const targetVertex = await self.get(parsed.feed, parsed.id, undefined, certacrypt_graph_1.SHARE_VIEW);
            const content = shareVertex.getContent();
            return new VirtualCommShareVertex(content.owner, content.info, parsed.name, shareVertex, targetVertex, result.sharedBy, [userUrl]);
        }
    }
    getAllSentShares(socialRoot) {
        const self = this;
        const userUrl = this.user.getPublicUrl();
        const shares = this.query(hyper_graphdb_1.Generator.from([socialRoot]))
            .out(exports.COMM_PATHS.SOCIAL_ROOT_TO_CHANNELS)
            .out()
            .generator()
            .map((init) => new Communication(this.graph, init, this.cacheDb))
            .map(async (comm) => {
            const sharedWith = (await comm.getParticipants()).map((p) => { var _a; return (_a = p.getContent()) === null || _a === void 0 ? void 0 : _a.userUrl; });
            const provisions = await comm.getSentProvisions();
            return provisions.map((p) => {
                return { msg: p, sharedWith };
            });
        })
            .flatMap((msgs) => hyper_graphdb_1.Generator.from(msgs.map(getShare)));
        return shares;
        async function getShare(result) {
            var _a, _b;
            const parsed = url_1.parseUrl(result.msg.shareUrl);
            if (parsed.type && parsed.type !== url_1.URL_TYPES.SHARE) {
                throw new Error('URL does not have type share: ' + result.msg.shareUrl);
            }
            self.graph.registerVertexKey(parsed.id, parsed.feed, parsed.key);
            const shareVertex = await self.get(parsed.feed, parsed.id, undefined, hyper_graphdb_1.GRAPH_VIEW);
            if (((_a = shareVertex.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) !== certacrypt_graph_1.SHARE_GRAPHOBJECT || shareVertex.getEdges().length !== 1) {
                throw new Error('invalid share vertex: type=' + ((_b = shareVertex.getContent()) === null || _b === void 0 ? void 0 : _b.typeName) + ' #edges=' + shareVertex.getEdges().length);
            }
            const targetVertex = await self.get(parsed.feed, parsed.id, undefined, certacrypt_graph_1.SHARE_VIEW);
            const content = shareVertex.getContent();
            return new VirtualCommShareVertex(content.owner, content.info, parsed.name, shareVertex, targetVertex, userUrl, result.sharedWith);
        }
    }
}
exports.CommunicationView = CommunicationView;
class CommShare extends graphObjects_1.VirtualGraphObject {
    equals(other) {
        return this.share.equals(other.share);
    }
}
exports.CommShare = CommShare;
class VirtualCommShareVertex {
    constructor(owner, info, name, share, target, sharedBy, sharedWith) {
        this.share = new CommShare();
        this.share.owner = owner;
        this.share.info = info;
        this.share.name = name;
        this.share.share = share;
        this.share.target = target;
        this.share.sharedBy = sharedBy;
        this.share.sharedWith = sharedWith;
    }
    getContent() {
        return this.share;
    }
    getEdges(label) {
        return this.share.share.getEdges(label);
    }
    equals(other) {
        var _a;
        if (((_a = other.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) !== this.share.typeName)
            return false;
        return this.share.equals(other.share);
    }
}
exports.VirtualCommShareVertex = VirtualCommShareVertex;
//# sourceMappingURL=communication.js.map