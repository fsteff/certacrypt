"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaStorage = void 0;
const graphObjects_1 = require("./graphObjects");
const errors_1 = require("hyperdrive/lib/errors");
const crypto_1 = require("./crypto");
const certacrypt_crypto_1 = require("certacrypt-crypto");
const hyperdrive_schemas_1 = require("hyperdrive-schemas");
const url_1 = require("./url");
const debug_1 = require("./debug");
class MetaStorage {
    constructor(drive, graph, root, crypto) {
        this.currentIdCtr = 0;
        this.drive = drive;
        this.graph = graph;
        this.root = root;
        this.crypto = crypto;
        this.tries = new Map();
    }
    async uniqueFileId() {
        const nodes = await new Promise((resolve, reject) => this.drive.db.list('.enc', { hidden: true }, (err, res) => err ? reject(err) : resolve(res)));
        let idCtr = this.currentIdCtr + 1;
        nodes.map(node => parseInt(node.key.split('/', 2)[1]))
            .forEach(id => idCtr = Math.max(idCtr, id + 1));
        this.currentIdCtr = idCtr;
        return '/.enc/' + idCtr;
    }
    async readableFile(filename, encrypted = true) {
        const file = await this.find(filename);
        if (!file)
            throw new errors_1.FileNotFound(filename);
        const { feed, path, mkey, fkey } = file;
        if (encrypted)
            this.crypto.registerKey(mkey, { feed, index: path, type: certacrypt_crypto_1.Cipher.XChaCha20_Blob });
        else
            this.crypto.registerPublic(feed, path);
        const trie = await this.getTrie(feed);
        const { stat, contentFeed } = await this.lstat(path, encrypted, trie, true);
        const dataFeed = contentFeed.key.toString('hex');
        if (encrypted)
            this.crypto.registerKey(fkey, { feed: dataFeed, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream, index: stat.offset });
        else
            this.crypto.registerPublic(dataFeed, stat.offset);
        debug_1.debug(`created readableFile ${filename} from ${encrypted ? 'encrypted' : 'public'} file hyper://${feed}${path}`);
        return { path, trie, stat, contentFeed };
    }
    async writeableFile(filename, encrypted = true) {
        let parsedFile = await this.find(filename);
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
        const created = await this.graph.createEdgesToPath(filename, this.root, vertex);
        for (const { path } of created) {
            const dirs = await this.graph.queryPathAtVertex(path, this.root)
                .matches(v => { var _a; return ((_a = v.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) === graphObjects_1.GraphObjectTypeNames.DIRECTORY; })
                .generator().destruct();
            if (dirs.length === 0) {
                await this.drive.promises.mkdir(path, { db: { encrypted: true } });
            }
        }
        return { path: fileid, fkey };
    }
    async createDirectory(name, makeStat) {
        const dirs = await this.graph.queryPathAtVertex(name, this.root).vertices();
        let target;
        for (const vertex of dirs) {
            const content = vertex.getContent();
            if ((content === null || content === void 0 ? void 0 : content.typeName) === graphObjects_1.GraphObjectTypeNames.DIRECTORY) {
                throw new errors_1.PathAlreadyExists(name);
            }
            if (content === null && vertex.getFeed() === this.root.getFeed()) {
                target = vertex;
            }
        }
        if (!target) {
            target = this.graph.create();
        }
        const feed = this.drive.db.feed.key.toString('hex');
        const mkey = this.crypto.generateEncryptionKey(certacrypt_crypto_1.Cipher.XChaCha20_Blob);
        const fileid = await this.uniqueFileId();
        const url = `hyper://${feed}${fileid}?mkey=${mkey.toString('hex')}`;
        const dir = new graphObjects_1.Directory();
        dir.filename = url;
        target.setContent(dir);
        this.crypto.registerKey(mkey, { feed, type: certacrypt_crypto_1.Cipher.XChaCha20_Blob, index: fileid });
        await new Promise((resolve, reject) => makeStat.call(null, fileid, err => err ? reject(err) : resolve(undefined)));
        await this.graph.put(target);
        await this.graph.createEdgesToPath(name, this.root, target);
        debug_1.debug(`created directory ${name} at hyper://${feed}${fileid}`);
        return target;
    }
    async find(path) {
        const vertex = latestWrite(await this.graph.queryPathAtVertex(path, this.root).vertices());
        if (!vertex)
            return null;
        const file = vertex.getContent();
        if (!file)
            throw new Error('vertex is not of type file or directory, it has no content at all');
        if (!file.filename)
            throw new Error('vertex is not of type file or directory, it does not have a filename url');
        const parsed = url_1.parseUrl(file.filename);
        return Object.assign({ vertex }, parsed);
    }
    lstat(path, encrypted, trie, file) {
        const self = this;
        const opts = { file: !!file, db: { trie, encrypted, hidden: !!encrypted } };
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
                if (stat && !passedTrie)
                    return resolve(stat);
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
                try {
                    var st = hyperdrive_schemas_1.Stat.decode(node.value);
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
    async getTrie(feedKey) {
        if (feedKey === this.drive.key.toString('hex'))
            return this.drive.db;
        if (this.tries.has(feedKey))
            return this.tries.get(feedKey);
        const trie = await crypto_1.cryptoTrie(this.drive.corestore, this.crypto, feedKey);
        this.tries.set(feedKey, trie);
        return trie;
    }
}
exports.MetaStorage = MetaStorage;
function latestWrite(vertices) {
    // TODO: use more sophisticated method - e.g. a view that makes sure there is only one vertex
    if (!vertices || vertices.length === 0)
        return null;
    else if (vertices.length === 1)
        return vertices[0];
    else
        return vertices.sort((a, b) => a.getTimestamp() - b.getTimestamp())[0];
}
//# sourceMappingURL=meta.js.map