"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualDriveShareVertex = exports.DriveShareView = exports.DriveShares = exports.DRIVE_SHARE_VIEW = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const certacrypt_graph_1 = require("certacrypt-graph");
const communication_1 = require("./communication");
const url_1 = require("./url");
const __1 = require("..");
const certacrypt_crypto_1 = require("certacrypt-crypto");
const space_1 = require("./space");
const errors_1 = require("hyperdrive/lib/errors");
const debug_1 = require("./debug");
exports.DRIVE_SHARE_VIEW = 'DriveShareView';
class DriveShares {
    constructor(graph, shares) {
        this.graph = graph;
        this.shares = shares;
    }
    async mountAt(drive, parentVertex, childLabel) {
        this.drive = drive;
        this.drive.setShares(this);
        let found = false;
        let existing = false;
        const edges = parentVertex.getEdges().map((edge) => {
            if (edge.label === childLabel) {
                if (edge.view === exports.DRIVE_SHARE_VIEW)
                    existing = true;
                edge.view = exports.DRIVE_SHARE_VIEW;
                found = true;
            }
            return edge;
        });
        if (!found) {
            throw new Error('Failed to mount driveshares, no such child');
        }
        // alread mounted
        if (existing)
            return;
        parentVertex.setEdges(edges);
        await this.graph.put(parentVertex);
    }
    async rotateKeysTo(updatedVertex) {
        const pathVertices = await this.findWriteableVerticesOnPathTo(updatedVertex);
        const affectedShares = await this.shares.findSharesTo(pathVertices.slice(1));
        // TODO: referrer rotation for spaces
        // do not rotate root vertex & ones that are psv-defined
        for (const vertex of pathVertices.slice(1)) {
            this.rotateKey(vertex);
        }
        // edge keys are updated on put()
        const rotated = pathVertices.concat(affectedShares);
        if (rotated.length > 0)
            await this.graph.put(rotated);
    }
    async rotateKeysToPath(path) {
        const root = await this.drive.updateRoot();
        const states = await this.graph.queryPathAtVertex(path, root).states();
        const writeable = states.filter((s) => {
            const v = s.value;
            return typeof v.getFeed === 'function' && v.getFeed() === root.getFeed();
        });
        if (writeable.length === 0)
            throw new errors_1.FileNotFound(path);
        return this.rotateKeysTo(writeable[0].value);
    }
    async revokeShare(share) {
        const content = share.getContent() || new certacrypt_graph_1.ShareGraphObject();
        content.revoked = true;
        share.setContent(content);
        await this.graph.put(share);
    }
    rotateKey(vertex) {
        const genkey = certacrypt_crypto_1.Primitives.generateEncryptionKey();
        this.graph.registerVertexKey(vertex.getId(), vertex.getFeed(), genkey);
    }
    async findWriteableVerticesOnPathTo(target) {
        const root = await this.drive.updateRoot();
        const graphView = this.graph.factory.get(hyper_graphdb_1.GRAPH_VIEW);
        const result = await this.findTarget(target, new hyper_graphdb_1.QueryState(root, [{ label: '', vertex: root, feed: root.getFeed() }], [], graphView), []);
        if (!result || result.path.length === 0) {
            debug_1.debug('no vertices for found that need key rotation');
            return [];
        }
        const path = result.path.map((p) => p.vertex);
        if (result instanceof space_1.SpaceQueryState) {
            const space = result.space.root;
            if (space.getFeed() === root.getFeed()) {
                path.push(space);
                await result.space.rotateReferrerKeys();
            }
        }
        const drivesharesIdx = path.findIndex(v => v instanceof VirtualDriveShareVertex);
        if (drivesharesIdx >= 0) {
            path.splice(0, drivesharesIdx + 1);
        }
        return path.filter((v) => this.isWriteable(v, root.getFeed()));
    }
    async getDrivePathTo(target) {
        const root = await this.drive.updateRoot();
        const graphView = this.graph.factory.get(hyper_graphdb_1.GRAPH_VIEW);
        const result = await this.findTarget(target, new hyper_graphdb_1.QueryState(root, [{ label: '', vertex: root, feed: root.getFeed() }], [], graphView), []);
        return result.path.map((p) => p.label).join('/');
    }
    async findTarget(target, state, visites) {
        const nextStates = await state.view
            .query(hyper_graphdb_1.Generator.from([state]))
            .out()
            .states();
        for (const state of nextStates) {
            if (state.value.equals(target))
                return state;
            if (visites.findIndex((v) => v.equals(state.value)) >= 0)
                continue;
            visites.push(state.value);
            const result = await this.findTarget(target, state, visites);
            if (result)
                return result;
        }
    }
    isWriteable(v, rootFeed) {
        return typeof v.getFeed === 'function' && v.getFeed() === rootFeed && typeof v.encode === 'function';
    }
}
exports.DriveShares = DriveShares;
class DriveShareView extends hyper_graphdb_1.View {
    constructor(cacheDb, graph, socialRoot, contentEncoding, factory, transactions) {
        super(graph.core, contentEncoding, factory, transactions);
        this.cacheDb = cacheDb;
        this.graph = graph;
        this.socialRoot = socialRoot;
        this.viewName = exports.DRIVE_SHARE_VIEW;
    }
    async get(edge, state) {
        const feed = edge.feed.toString('hex');
        const shareEdges = await this.getShareEdges(edge, state);
        const edges = shareEdges.map((s) => s.edge);
        const meta = shareEdges.map((s) => s.share);
        const tr = await this.getTransaction(feed);
        const realVertex = await this.db.getInTransaction(edge.ref, this.codec, tr, feed);
        return [Promise.resolve(this.toResult(new VirtualDriveShareVertex(edges.concat(realVertex.getEdges()), realVertex, meta), edge, state))];
    }
    async getShareEdges(prevEdge, state) {
        const path = [prevEdge.label].concat(state.path.map((p) => p.label)).join('/');
        const view = this.getView(communication_1.COMM_VIEW);
        const shares = await this.query(hyper_graphdb_1.Generator.from([state.mergeStates(this.socialRoot)]))
            .out(communication_1.COMM_PATHS.COMM_TO_RCV_SHARES, view)
            .generator()
            .values((err) => console.error('DriveShareView: failed to load share:' + err))
            .filter((v) => !!v.getContent())
            .destruct();
        const shareEdges = shares
            .map((v) => v.getContent())
            .map((c) => {
            const edge = this.uniqueEdge(c);
            return {
                share: {
                    share: __1.createUrl(c.share, this.graph.getKey(c.share), undefined, __1.URL_TYPES.SHARE, c.name),
                    owner: c.owner,
                    name: c.name,
                    path: '/' + path + '/' + edge.label,
                    label: edge.label
                },
                edge
            };
        });
        return shareEdges;
    }
    uniqueEdge(share) {
        const userParsed = url_1.parseUrl(share.sharedBy);
        const userLabel = userParsed.id + '@' + userParsed.feed;
        const shareLabel = share.share.getId() + '@' + share.share.getFeed();
        return {
            ref: share.share.getId(),
            feed: Buffer.from(share.share.getFeed(), 'hex'),
            label: encodeURIComponent(userLabel + '/' + shareLabel),
            metadata: { key: this.graph.getKey(share.share) },
            view: certacrypt_graph_1.SHARE_VIEW
        };
    }
}
exports.DriveShareView = DriveShareView;
class VirtualDriveShareVertex {
    constructor(edges, realVertex, meta) {
        this.edges = edges;
        this.realVertex = realVertex;
        this.meta = meta;
    }
    getContent() {
        return this.realVertex.getContent();
    }
    getEdges(label) {
        return this.edges.filter((e) => !label || label === e.label);
    }
    equals(other) {
        return this.realVertex.equals(other);
    }
    getVersion() {
        return this.realVertex.getVersion();
    }
    getFeed() {
        return this.realVertex.getFeed();
    }
    getId() {
        return this.realVertex.getId();
    }
    getWriteable() {
        return this.realVertex.getWriteable();
    }
    getMetadata() {
        this.realVertex.getMetadata();
    }
    getShareMetaData() {
        return this.meta;
    }
}
exports.VirtualDriveShareVertex = VirtualDriveShareVertex;
//# sourceMappingURL=driveshares.js.map