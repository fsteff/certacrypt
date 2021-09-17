"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Communication = exports.COMM_PATHS = exports.SOCIAL_ROOT = void 0;
const graphObjects_1 = require("./graphObjects");
const url_1 = require("./url");
exports.SOCIAL_ROOT = '/social';
exports.COMM_PATHS = {
    SOCIAL_ROOT_TO_CHANNELS: 'channels',
    MSG_REQUESTS: 'requests',
    MSG_PROVISION: 'provision',
    PARTICIPANTS: 'participants'
};
class Communication {
    constructor(graph, userInit, cache) {
        this.graph = graph;
        this.userInit = userInit;
        this.cache = cache;
    }
    static async InitUserCommunication(graph, socialRoot, cache, user, addressant) {
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
//# sourceMappingURL=communication.js.map