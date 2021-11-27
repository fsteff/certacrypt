"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaStorage = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const graphObjects_1 = require("./graphObjects");
const errors_1 = require("hyperdrive/lib/errors");
const crypto_1 = require("./crypto");
const certacrypt_crypto_1 = require("certacrypt-crypto");
const hyperdrive_schemas_1 = require("hyperdrive-schemas");
const url_1 = require("./url");
const debug_1 = require("./debug");
const space_1 = require("./space");
const __1 = require("..");
class MetaStorage {
    constructor(drive, graph, root, crypto) {
        this.currentIdCtr = 0;
        this.drive = drive;
        this.graph = graph;
        this.root = root;
        this.crypto = crypto;
        this.tries = new Map();
    }
    async updateRoot(root) {
        if (root) {
            this.root = root;
        }
        else {
            this.root = await this.graph.get(this.root.getId(), this.root.getFeed());
        }
        return this.root;
    }
    async uniqueFileId() {
        const nodes = (await new Promise((resolve, reject) => this.drive.db.list('.enc', { hidden: true }, (err, res) => (err ? reject(err) : resolve(res)))));
        let idCtr = this.currentIdCtr + 1;
        nodes.map((node) => parseInt(node.key.split('/', 2)[1])).forEach((id) => (idCtr = Math.max(idCtr, id + 1)));
        this.currentIdCtr = idCtr;
        return '/.enc/' + idCtr;
    }
    async readableFile(filename, encrypted = true) {
        var _a;
        const file = await this.find(filename, false);
        if (!file)
            throw new errors_1.FileNotFound(filename);
        const { vertex, feed, path, mkey, fkey, space } = file;
        if (((_a = vertex.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.THOMBSTONE) {
            return { path: null, trie: null, stat: null, contentFeed: null };
        }
        if (encrypted)
            this.crypto.registerKey(mkey, { feed, index: path, type: certacrypt_crypto_1.Cipher.XChaCha20_Blob });
        else
            this.crypto.registerPublic(feed, path);
        const trie = await this.getTrie(feed);
        const { stat, contentFeed } = await this.lstat(vertex, path, encrypted, trie, true);
        const dataFeed = contentFeed.key.toString('hex');
        if (encrypted)
            this.crypto.registerKey(fkey, { feed: dataFeed, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream, index: stat.offset });
        else
            this.crypto.registerPublic(dataFeed, stat.offset);
        const typeName = vertex.getContent().typeName;
        if (typeName === graphObjects_1.GraphObjectTypeNames.FILE)
            stat.isFile = true;
        else if (typeName === graphObjects_1.GraphObjectTypeNames.DIRECTORY)
            stat.isDirectory = true;
        const spaceMeta = space ? await this.getSpaceMetaData(space) : undefined;
        debug_1.debug(`created readableFile ${filename} from ${encrypted ? 'encrypted' : 'public'} ${stat.isFile ? 'file' : 'directory'} hyper://${feed}${path}`);
        return { path, trie, stat, contentFeed, spaceMeta, space };
    }
    async writeableFile(filename, encrypted = true) {
        let parsedFile = await this.find(filename, true);
        let fileid;
        let vertex = parsedFile === null || parsedFile === void 0 ? void 0 : parsedFile.vertex;
        const feed = this.drive.key.toString('hex');
        if (parsedFile) {
            if (encrypted)
                this.crypto.registerKey(parsedFile.mkey, { feed, index: parsedFile.path, type: certacrypt_crypto_1.Cipher.XChaCha20_Blob });
            else
                this.crypto.registerPublic(feed, parsedFile.path);
            fileid = parsedFile.path;
        }
        else {
            vertex = this.graph.create();
            if (encrypted)
                fileid = await this.uniqueFileId();
            else
                fileid = filename;
        }
        let url = 'hyper://' + feed + fileid;
        let fkey;
        if (encrypted) {
            const mkey = this.crypto.generateEncryptionKey(certacrypt_crypto_1.Cipher.XChaCha20_Blob);
            fkey = this.crypto.generateEncryptionKey(certacrypt_crypto_1.Cipher.ChaCha20_Stream);
            this.crypto.registerKey(mkey, { feed, type: certacrypt_crypto_1.Cipher.XChaCha20_Blob, index: fileid });
            // fkey has to be passed out to make sure the feed length isn't changed (wait until lock is set up)
            url += `?mkey=${mkey.toString('hex')}&fkey=${fkey.toString('hex')}`;
        }
        else {
            this.crypto.registerPublic(feed, fileid);
        }
        const file = new graphObjects_1.File();
        file.filename = url;
        vertex.setContent(file);
        await this.graph.put(vertex);
        debug_1.debug(`created writeableFile ${filename} as ${encrypted ? 'encrypted' : 'public'} file hyper://${feed}${fileid}`);
        const created = await this.createPath(filename, vertex); //this.graph.createEdgesToPath(filename, this.root, vertex)
        // reload root to be sure
        this.root = await this.graph.get(this.root.getId(), this.root.getFeed());
        for (const { path } of created) {
            const dirs = await this.graph
                .queryPathAtVertex(path, this.root)
                .matches((v) => { var _a; return ((_a = v.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.DIRECTORY; })
                .generator()
                .destruct();
            if (dirs.length === 0) {
                await this.drive.promises.mkdir(path, { db: { encrypted: true } });
            }
        }
        return { path: fileid, fkey };
    }
    async createDirectory(name, makeStat) {
        let target;
        const writeable = await this.findWriteablePath(name);
        const vertex = ((writeable === null || writeable === void 0 ? void 0 : writeable.remainingPath.length) === 0 ? writeable === null || writeable === void 0 ? void 0 : writeable.state.value : undefined);
        const content = vertex === null || vertex === void 0 ? void 0 : vertex.getContent();
        if (content && content.filename) {
            throw new errors_1.PathAlreadyExists(name);
        }
        if ((vertex === null || vertex === void 0 ? void 0 : vertex.getFeed()) === this.root.getFeed()) {
            target = vertex;
        }
        else {
            target = this.graph.create();
        }
        const feed = this.drive.db.feed.key.toString('hex');
        const mkey = this.crypto.generateEncryptionKey(certacrypt_crypto_1.Cipher.XChaCha20_Blob);
        const fileid = await this.uniqueFileId();
        const url = `hyper://${feed}${fileid}?mkey=${mkey.toString('hex')}`;
        const dir = target.getContent() || new graphObjects_1.Directory();
        dir.filename = url;
        target.setContent(dir);
        this.crypto.registerKey(mkey, { feed, type: certacrypt_crypto_1.Cipher.XChaCha20_Blob, index: fileid });
        await new Promise((resolve, reject) => makeStat.call(null, fileid, (err) => (err ? reject(err) : resolve(undefined))));
        await this.graph.put(target);
        if (this.root.getId() === target.getId() && this.root.getFeed() === target.getFeed()) {
            this.root = target;
        }
        else {
            await this.createPath(name, target);
        }
        debug_1.debug(`created directory ${name} at hyper://${feed}${fileid}`);
        return target;
    }
    async find(path, writeable) {
        var _a, _b;
        let vertex;
        let space;
        if (writeable) {
            const writeablePath = await this.findWriteablePath(path);
            if (!writeablePath) {
                throw new Error('file or path is not writeable: ' + path);
            }
            space = writeablePath.state.space;
            if (((_a = writeablePath.remainingPath) === null || _a === void 0 ? void 0 : _a.length) === 0) {
                vertex = writeablePath.state.value;
            }
        }
        else {
            const states = await this.graph.queryPathAtVertex(path, this.root, undefined, thombstoneReductor).generator().rawQueryStates(onError);
            vertex = this.latestWrite(states.map((s) => s.value));
            space = (_b = states.find((s) => s.value.equals(vertex))) === null || _b === void 0 ? void 0 : _b.space;
        }
        if (!vertex)
            return null;
        const file = vertex.getContent();
        if (!file)
            throw new Error('vertex is not of type file or directory, it has no content at all');
        if (file.typeName === graphObjects_1.GraphObjectTypeNames.THOMBSTONE)
            return { vertex, id: 0, feed: '', path: '', version: 0, mkey: null, fkey: null }; // file has been deleted
        if (!file.filename)
            throw new Error('vertex is not of type file or directory, it does not have a filename url');
        const parsed = url_1.parseUrl(file.filename);
        return Object.assign({ vertex, space }, parsed);
        function onError(err) {
            console.error('failed to find vertex for path ' + path);
            throw err;
        }
        function thombstoneReductor(arr) {
            var _a;
            if (!arr || arr.length === 0)
                return [];
            arr.sort((a, b) => { var _a, _b; return (((_a = b.value.getContent()) === null || _a === void 0 ? void 0 : _a.timestamp) || 0) - (((_b = a.value.getContent()) === null || _b === void 0 ? void 0 : _b.timestamp) || 0); });
            if (((_a = arr[0].value.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.THOMBSTONE) {
                return [];
            }
            else {
                return arr;
            }
        }
    }
    lstat(vertex, path, encrypted, trie, file) {
        var _a, _b;
        const self = this;
        const opts = { file: !!file, db: { trie, encrypted, hidden: !!encrypted } };
        const isFile = ((_a = vertex.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.FILE;
        const isDirectory = ((_b = vertex.getContent()) === null || _b === void 0 ? void 0 : _b.typeName) === graphObjects_1.GraphObjectTypeNames.DIRECTORY;
        return new Promise((resolve, reject) => {
            if (trie && trie !== self.drive.db) {
                trie.get(path, opts.db, onRemoteStat);
            }
            else {
                this.drive.lstat(path, opts, onStat);
            }
            function onStat(err, stat, passedTrie) {
                if (err)
                    return reject(err);
                if (stat) {
                    stat.isFile = isFile;
                    stat.isDirectory = isDirectory;
                }
                if (stat && !passedTrie) {
                    return resolve({ stat, trie: passedTrie, contentFeed: undefined });
                }
                self.drive._getContent(passedTrie.feed, (err, contentState) => {
                    if (err)
                        return reject(err);
                    else
                        resolve({ stat, trie: passedTrie, contentFeed: contentState.feed });
                });
            }
            function onRemoteStat(err, node, trie) {
                if (err)
                    return reject(err);
                // vanilla hyperdrive mounts are not supported yet
                if (!node && opts.file)
                    return reject(new errors_1.FileNotFound(path));
                if (!node)
                    return onStat(null, hyperdrive_schemas_1.Stat.directory(), trie); // TODO: modes?
                let st;
                try {
                    st = hyperdrive_schemas_1.Stat.decode(node.value);
                }
                catch (err) {
                    return reject(err);
                }
                const writingFd = self.drive._writingFds.get(path);
                if (writingFd) {
                    st.size = writingFd.stat.size;
                }
                onStat(null, st, trie);
            }
        });
    }
    async unlink(name) {
        const path = name.split('/').filter((p) => p.length > 0);
        if (path.length === 0)
            throw new Error('cannot unlink root');
        const filename = path[path.length - 1];
        const thombstone = this.graph.create();
        thombstone.setContent(new graphObjects_1.Thombstone());
        await this.graph.put(thombstone);
        let results = await this.graph.queryPathAtVertex(name, this.root).vertices();
        if (results.length === 0) {
            throw new Error('File not found, cannot unlink');
        }
        const writeable = await this.findWriteablePath(name);
        if (!writeable) {
            throw new Error('File is not writeable, cannot unlink');
        }
        if (writeable.remainingPath.length === 0) {
            const file = writeable.state.value;
            const parent = writeable.state.path[writeable.state.path.length - 2].vertex;
            parent.replaceEdgeTo(file, (_edge) => {
                return {
                    ref: thombstone.getId(),
                    label: filename,
                    metadata: { key: this.graph.getKey(thombstone) }
                };
            });
            await this.graph.put(parent);
            debug_1.debug(`placed thombstone to ${name} and unlinked edge to hyper://${file.getFeed()}/${file.getId()}`);
        }
        else {
            await this.createPath(name, thombstone);
            debug_1.debug('placed thombstone to ' + name);
        }
    }
    async getTrie(feedKey) {
        if (feedKey === this.drive.key.toString('hex'))
            return this.drive.db;
        if (this.tries.has(feedKey))
            return this.tries.get(feedKey);
        const trie = await crypto_1.cryptoTrie(this.drive.corestore, this.crypto, feedKey);
        this.tries.set(feedKey, trie);
        return trie;
    }
    async createPath(absolutePath, leaf) {
        const path = await this.findWriteablePath(absolutePath);
        if (!path) {
            throw new Error('createPath: path is not writeable');
        }
        const lastWriteable = path.state.value;
        // update vertices to update timestamps
        const pathWriteables = path.state.path
            .slice(0, path.state.path.length - 1)
            .map((p) => p.vertex)
            .filter((p) => typeof p.getFeed === 'function' && p.getFeed() === lastWriteable.getFeed());
        if (pathWriteables.length > 0)
            await this.graph.put(pathWriteables);
        return this.graph.createEdgesToPath(path.remainingPath.join('/'), lastWriteable, leaf);
    }
    async findWriteablePath(absolutePath) {
        const self = this;
        const parts = absolutePath.split('/').filter((p) => p.trim().length > 0);
        return traverse(new hyper_graphdb_1.QueryState(this.root, [], [], this.graph.factory.get(hyper_graphdb_1.GRAPH_VIEW)), parts);
        async function traverse(state, path) {
            let nextStates = path.length > 0 ? await out(state, path[0]) : [];
            if (nextStates.length === 0) {
                const vertex = state.value;
                if (typeof vertex.getFeed === 'function' && vertex.getFeed() === self.root.getFeed()) {
                    return { state, remainingPath: path };
                }
                else {
                    return undefined;
                }
            }
            for (const next of nextStates) {
                const result = await traverse(next, path.slice(1));
                if (result)
                    return result;
            }
            // in case the user's PSV has not been written to (yet), create a root dir
            for (const next of nextStates) {
                if (!(next instanceof space_1.SpaceQueryState))
                    continue;
                // get the owner's root dir id+feed
                const spaceOwnerEdge = next.space.root
                    .getEdges('.')
                    .map((edge) => {
                    var _a;
                    return { id: edge.ref, feed: ((_a = edge.feed) === null || _a === void 0 ? void 0 : _a.toString()) || next.space.root.getFeed() };
                })
                    .filter((e) => e.feed === next.space.root.getFeed())[0];
                if (!spaceOwnerEdge)
                    continue;
                // check if current vertex is the owner's root dir
                const v = next.value;
                if (v.getId() !== spaceOwnerEdge.id || v.getFeed() !== spaceOwnerEdge.feed)
                    continue;
                // get writer root dir
                const writeable = await getOrCreateWriteable(next, path, state);
                if (writeable)
                    return await traverse(writeable, path.slice(1));
            }
            return undefined;
        }
        async function getOrCreateWriteable(next, path, state) {
            const space = next.space;
            let writeable;
            try {
                writeable = await space.tryGetWriteableRoot();
                // if PSV has not been written to, this creates an empty vertex
                if (!writeable) {
                    writeable = await space.createWriteableRoot();
                }
                return new space_1.SpaceQueryState(writeable, state.path, state.rules, state.view, space).nextState(writeable, path[0], writeable.getFeed(), state.view);
            }
            catch (err) {
                debug_1.debug('findWriteablePath: no permissions to write to space ' + space.root.getId() + '@' + space.root.getFeed());
            }
        }
        async function out(state, label) {
            return state.view
                .query(hyper_graphdb_1.Generator.from([state]))
                .out(label)
                .states();
        }
    }
    async getSpaceMetaData(space) {
        const owner = space.getOwnerUrl();
        const writers = await space.getWriterUrls();
        const isWriteable = space.userHasWriteAccess();
        const spaceRoot = __1.createUrl(space.root, this.graph.getKey(space.root), undefined, __1.URL_TYPES.SPACE);
        return { space: spaceRoot, owner, writers, isWriteable };
    }
    latestWrite(vertices) {
        // TODO: use more sophisticated method - e.g. a view that makes sure there is only one vertex
        if (!vertices || vertices.length === 0)
            return null;
        else if (vertices.length === 1)
            return vertices[0];
        return vertices.sort((a, b) => timestamp(b) - timestamp(a))[0];
        function timestamp(vertex) {
            if (typeof vertex.getTimestamp === 'function')
                return vertex.getTimestamp();
            else
                return 0;
        }
    }
    latestWrites(states) {
        if (!states || states.length < 2)
            return states;
        const map = new Map();
        for (const state of states) {
            const path = state.path.map((p) => p.label).join('/');
            if (map.has(path)) {
                const other = map.get(path);
                const newer = [state, other].sort((a, b) => timestamp(b) - timestamp(a))[0];
                map.set(path, newer);
            }
            else {
                map.set(path, state);
            }
        }
        return [...map.values()];
        function timestamp(state) {
            const vertex = state.value;
            if (typeof vertex.getTimestamp === 'function')
                return vertex.getTimestamp();
            else
                return 0;
        }
    }
}
exports.MetaStorage = MetaStorage;
//# sourceMappingURL=meta.js.map