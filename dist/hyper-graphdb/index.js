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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HyperGraphDB = exports.GRAPH_VIEW = exports.View = exports.Errors = exports.Generator = exports.Crawler = exports.Query = exports.Core = exports.SimpleGraphObject = exports.GraphObject = exports.Vertex = void 0;
const Core_1 = require("./lib/Core");
Object.defineProperty(exports, "Core", { enumerable: true, get: function () { return Core_1.Core; } });
const Codec_1 = require("./lib/Codec");
Object.defineProperty(exports, "SimpleGraphObject", { enumerable: true, get: function () { return Codec_1.SimpleGraphObject; } });
Object.defineProperty(exports, "GraphObject", { enumerable: true, get: function () { return Codec_1.GraphObject; } });
const Vertex_1 = require("./lib/Vertex");
Object.defineProperty(exports, "Vertex", { enumerable: true, get: function () { return Vertex_1.Vertex; } });
const Crawler_1 = __importDefault(require("./lib/Crawler"));
exports.Crawler = Crawler_1.default;
const Query_1 = require("./lib/Query");
Object.defineProperty(exports, "Query", { enumerable: true, get: function () { return Query_1.Query; } });
const View_1 = require("./lib/View");
Object.defineProperty(exports, "GRAPH_VIEW", { enumerable: true, get: function () { return View_1.GRAPH_VIEW; } });
const Generator_1 = require("./lib/Generator");
Object.defineProperty(exports, "Generator", { enumerable: true, get: function () { return Generator_1.Generator; } });
const Errors = __importStar(require("./lib/Errors"));
exports.Errors = Errors;
const View_2 = require("./lib/View");
Object.defineProperty(exports, "View", { enumerable: true, get: function () { return View_2.View; } });
const ViewFactory_1 = require("./lib/ViewFactory");
class HyperGraphDB {
    constructor(corestore, key, opts, customCore) {
        this.codec = new Codec_1.Codec();
        this.core = customCore || new Core_1.Core(corestore, key, opts);
        this.codec.registerImpl(data => new Codec_1.SimpleGraphObject(data));
        this.crawler = new Crawler_1.default(this.core);
        this.factory = new ViewFactory_1.ViewFactory(this.core, this.codec);
        this.factory.register(View_1.GRAPH_VIEW, (db, codec, tr) => new View_1.GraphView(db, codec, this.factory, tr));
    }
    async put(vertex, feed) {
        feed = feed || await this.core.getDefaultFeedId();
        if (Array.isArray(vertex)) {
            return await this.core.putAll(feed, vertex);
        }
        else {
            return await this.core.put(feed, vertex);
        }
    }
    async get(id, feed) {
        feed = feed || await this.core.getDefaultFeedId();
        return await this.core.get(feed, id, this.codec);
    }
    get indexes() {
        return this.crawler.indexes;
    }
    create() {
        return new Vertex_1.Vertex(this.codec);
    }
    queryIndex(indexName, key, view) {
        const idx = this.indexes.find(i => i.indexName === indexName);
        if (!idx)
            throw new Error('no index of name "' + indexName + '" found');
        const vertices = new Array();
        const transactions = new Map();
        for (const { id, feed } of idx.get(key)) {
            let tr;
            if (!transactions.has(feed)) {
                tr = this.core.transaction(feed);
                tr.then(tr => transactions.set(feed, tr));
            }
            else {
                tr = Promise.resolve(transactions.get(feed));
            }
            const promise = tr.then(tr => this.core.getInTransaction(id, this.codec, tr, feed));
            vertices.push(promise);
        }
        if (!view)
            view = this.factory.get(View_1.GRAPH_VIEW, transactions);
        return view.query(Generator_1.Generator.from(vertices));
    }
    queryAtId(id, feed, view) {
        const transactions = new Map();
        feed = (Buffer.isBuffer(feed) ? feed.toString('hex') : feed);
        const trPromise = this.core.transaction(feed);
        const vertex = trPromise.then(tr => {
            const v = this.core.getInTransaction(id, this.codec, tr, feed);
            transactions.set(feed, tr);
            return v;
        });
        if (!view)
            view = this.factory.get(View_1.GRAPH_VIEW, transactions);
        return view.query(Generator_1.Generator.from([vertex]));
    }
    queryAtVertex(vertex, view) {
        return this.queryAtId(vertex.getId(), vertex.getFeed(), view);
    }
    queryPathAtVertex(path, vertex, view) {
        const parts = path.replace(/\\/g, '/').split('/').filter(s => s.length > 0);
        let last = this.queryAtVertex(vertex, view);
        for (const next of parts) {
            last = last.out(next);
        }
        return last;
    }
    async createEdgesToPath(path, root, leaf) {
        const self = this;
        const parts = path.replace(/\\/g, '/').split('/').filter(s => s.length > 0);
        let leafName = '';
        if (leaf) {
            leafName = parts.splice(parts.length - 1, 1)[0];
        }
        if (!root.getWriteable())
            throw new Error('passed root vertex has to be writeable');
        const tr = await this.core.transaction(root.getFeed());
        const feed = tr.store.key;
        const created = new Array();
        const route = new Array();
        let currentPath = '';
        for (const next of parts) {
            let current;
            currentPath += '/' + next;
            const edges = root.getEdges(next).filter(e => !e.feed || e.feed.equals(feed));
            const vertices = await Promise.all(getVertices(edges));
            if (vertices.length === 0) {
                current = this.create();
                created.push(current);
                route.push({ parent: root, child: current, label: next, path: currentPath });
            }
            else if (vertices.length === 1) {
                current = vertices[0];
            }
            else {
                current = vertices.sort(newest)[0];
            }
            root = current;
        }
        if (created.length > 0) {
            await this.put(created, feed);
        }
        const changes = new Array();
        for (const v of route) {
            v.parent.addEdgeTo(v.child, v.label);
            changes.push(v.parent);
        }
        if (leaf) {
            const last = route.length > 0 ? route[route.length - 1].child : root;
            const matchingEdge = last.getEdges(leafName).find(e => (!Buffer.isBuffer(e.feed) || feed.equals(e.feed)) && e.ref === leaf.getId());
            if (!matchingEdge) {
                last.addEdgeTo(leaf, leafName);
                changes.push(last);
            }
        }
        if (changes.length > 0) {
            await this.put(changes, feed);
        }
        return route;
        function getVertices(edges) {
            return edges.map(e => self.core.getInTransaction(e.ref, self.codec, tr, feed.toString('hex')));
        }
        function newest(a, b) {
            return (b.getTimestamp() || 0) - (a.getTimestamp() || 0);
        }
    }
}
exports.HyperGraphDB = HyperGraphDB;
//# sourceMappingURL=index.js.map