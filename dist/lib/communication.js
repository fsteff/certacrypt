"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Communication = exports.COMM_PATHS = exports.COMM_ROOT = void 0;
const graphObjects_1 = require("./graphObjects");
const url_1 = require("./url");
exports.COMM_ROOT = '/social';
exports.COMM_PATHS = {
    COMM_ROOT_TO_USERS: 'users',
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
    static async InitUserCommunication(graph, commRoot, cache, user, addressant) {
        const comm = new Communication(graph, message(graph, { userUrl: user.getPublicUrl(), type: 'Init' }), cache);
        await graph.put(comm.userInit);
        let userComm;
        const results = await graph.queryPathAtVertex(exports.COMM_PATHS.COMM_ROOT_TO_USERS, commRoot).vertices();
        if (results.length > 0) {
            userComm = results[0];
        }
        else {
            userComm = graph.create();
            await graph.put(userComm);
            commRoot.addEdgeTo(userComm, exports.COMM_PATHS.COMM_ROOT_TO_USERS);
            await graph.put(commRoot);
        }
        const label = addressant.getPublicUrl();
        userComm.addEdgeTo(comm.userInit, label);
        await graph.put(userComm);
        const mail = await user.getInbox();
        await mail.postEnvelope(userComm, addressant);
        await comm.checkInbox(addressant);
        return comm;
    }
    async getParticipants() {
        return this.graph.queryPathAtVertex(exports.COMM_PATHS.PARTICIPANTS, this.userInit).vertices();
    }
    async checkInbox(participant) {
        const mail = await participant.getInbox(true);
        const cachePath = `communication/user/${encodeURIComponent(participant.getPublicUrl())}/inboxLastCheckedVersion}`;
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
        const iter = await this.graph
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
    async getProvisions() {
        var e_2, _a;
        const iter = await this.graph
            .queryPathAtVertex(exports.COMM_PATHS.PARTICIPANTS + '/' + exports.COMM_PATHS.MSG_PROVISION, this.userInit)
            .values((v) => v.getContent());
        const results = new Array();
        try {
            for (var iter_2 = __asyncValues(iter), iter_2_1; iter_2_1 = await iter_2.next(), !iter_2_1.done;) {
                const msg = iter_2_1.value;
                if (!['Share'].includes(msg.type)) {
                    throw new Error('Message is not a provision: ' + msg.type);
                }
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
}
exports.Communication = Communication;
function message(graph, value) {
    const vertex = graph.create();
    vertex.setContent(Object.assign(new graphObjects_1.JsonGraphObject(), value));
    return vertex;
}
//# sourceMappingURL=communication.js.map