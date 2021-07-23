"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Core = void 0;
const hyperobjects_1 = require("hyperobjects");
const hyperobjects_2 = require("hyperobjects");
const Vertex_1 = require("./Vertex");
const Errors_1 = require("./Errors");
const is_loopback_addr_1 = __importDefault(require("is-loopback-addr"));
class Core {
    constructor(corestore, key, opts) {
        this.objectStores = new Map();
        this.corestore = corestore;
        this.opts = opts;
        this.defaultFeed = this.getStore(key);
    }
    async get(feed, id, contentEncoding, version) {
        const vertexId = typeof id === 'string' ? parseInt(id, 16) : id;
        feed = this.feedId(feed);
        const tr = await this.transaction(feed, undefined, version);
        return this.getInTransaction(vertexId, contentEncoding, tr, feed);
    }
    async getInTransaction(id, contentEncoding, tr, feed) {
        const vertexId = typeof id === 'string' ? parseInt(id, 16) : id;
        const version = await tr.getPreviousTransactionIndex();
        const timestamp = (await tr.getPreviousTransactionMarker()).timestamp;
        return tr.get(vertexId)
            .then(obj => {
            const vertex = Vertex_1.Vertex.decode(obj, contentEncoding, version);
            vertex.setId(vertexId);
            vertex.setFeed(feed);
            vertex.setWritable(tr.store.writable);
            vertex.setTimestamp(timestamp);
            return vertex;
        }).catch(err => { throw new Errors_1.VertexDecodingError(vertexId, err); });
    }
    async put(feed, vertex) {
        return this.putAll(feed, [vertex]);
    }
    async putAll(feed, vertices) {
        const ids = new Array();
        let trans;
        await this.transaction(feed, async (tr) => {
            trans = tr;
            for (const vertex of vertices) {
                const encoded = vertex.encode();
                if (vertex.getId() < 0) {
                    const id = await tr.create(encoded);
                    ids.push({ vertex, id: id });
                }
                else {
                    await tr.set(vertex.getId(), encoded);
                }
            }
        });
        const version = await (trans === null || trans === void 0 ? void 0 : trans.getPreviousTransactionIndex());
        const marker = await (trans === null || trans === void 0 ? void 0 : trans.getPreviousTransactionMarker());
        for (const { vertex, id } of ids) {
            vertex.setId(id === null || id === void 0 ? void 0 : id.id);
            vertex.setFeed(this.feedId(feed));
            vertex.setVersion(version);
            vertex.setTimestamp(marker === null || marker === void 0 ? void 0 : marker.timestamp);
            vertex.setWritable(true);
        }
    }
    async getDefaultFeedId() {
        return (await this.defaultFeed).feed.feed.key;
    }
    feedId(feed) {
        if (Buffer.isBuffer(feed)) {
            return feed.toString('hex');
        }
        else if (typeof feed === 'string') {
            return feed;
        }
        else {
            throw new Error('feed is not a string or Buffer');
        }
    }
    async getStore(feed) {
        const self = this;
        if (!feed) {
            const created = await getDB();
            this.objectStores.set(created.feed.feed.key.toString('hex'), created);
            return created;
        }
        feed = this.feedId(feed);
        const store = this.objectStores.get(feed);
        if (store) {
            return store;
        }
        else {
            const created = await getDB(feed);
            this.objectStores.set(feed, created);
            return created;
        }
        async function getDB(feed) {
            const core = self.corestore.get(feed ? { key: feed } : undefined);
            const created = new hyperobjects_2.HyperObjects(core, { onRead, onWrite });
            await created.feed.ready();
            if (!core.writable) {
                const connect = new Promise((resolve, _) => {
                    if (core.peers.filter(p => !is_loopback_addr_1.default(p.remoteAddress)).length > 0) {
                        return resolve(undefined);
                    }
                    core.once('peer-add', peer => resolve(undefined));
                });
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('peer lookup timed out (5s) for feed ' + feed)), 5000));
                await Promise.race([connect, timeout])
                    .catch(err => console.error(err))
                    .then(() => created.feed.update(1))
                    .catch(err => {
                    if (core.length === 0)
                        throw new Error(err.message + ' for feed ' + feed);
                    else
                        console.error(err.message + ' for feed ' + feed);
                });
            }
            return created;
            function onRead(index, data) {
                var _a, _b;
                if ((_a = self.opts) === null || _a === void 0 ? void 0 : _a.onRead)
                    return (_b = self.opts) === null || _b === void 0 ? void 0 : _b.onRead(data, core.key, index);
                else
                    return data;
            }
            function onWrite(index, data) {
                var _a, _b;
                if ((_a = self.opts) === null || _a === void 0 ? void 0 : _a.onWrite)
                    return (_b = self.opts) === null || _b === void 0 ? void 0 : _b.onWrite(data, core.key, index);
                else
                    return data;
            }
        }
    }
    async transaction(feed, exec, version) {
        const store = await this.getStore(feed);
        await store.storage.ready();
        const head = version || await store.feed.length();
        const tr = new hyperobjects_1.Transaction(store.storage, head);
        await tr.ready();
        if (exec) {
            const retval = await exec(tr);
            await tr.commit();
            return retval;
        }
        return tr;
    }
}
exports.Core = Core;
//# sourceMappingURL=Core.js.map