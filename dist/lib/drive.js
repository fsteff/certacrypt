"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cryptoDrive = void 0;
const certacrypt_crypto_1 = require("certacrypt-crypto");
const crypto_1 = require("./crypto");
const meta_1 = require("./meta");
const hyperdrive_1 = __importDefault(require("hyperdrive"));
const hypercore_byte_stream_1 = __importDefault(require("hypercore-byte-stream"));
const minipass_1 = __importDefault(require("minipass"));
const unixify_1 = __importDefault(require("unixify"));
async function cryptoDrive(corestore, graph, crypto, root) {
    corestore = crypto_1.cryptoCorestore(corestore.namespace('cryptoDrive'), crypto);
    const drive = hyperdrive_1.default(corestore); // dirty fix
    await drive.promises.ready();
    const meta = new meta_1.MetaStorage(drive, graph, root, crypto);
    drive.db = crypto_1.wrapTrie(drive.db, crypto);
    const oldCreateWriteStream = drive.createWriteStream;
    const oldLstat = drive.lstat;
    const oldReaddir = drive.readdir;
    const oldMkdir = drive.mkdir;
    const oldUnlink = drive.unlink;
    drive.createReadStream = createReadStream;
    drive.createWriteStream = createWriteStream;
    drive.lstat = lstat;
    drive.readdir = readdir;
    drive.mkdir = mkdir;
    drive.unlink = unlink;
    drive.promises.unlink = unlink;
    return drive;
    function createReadStream(name, opts) {
        name = unixify_1.default(name);
        opts = fixOpts(opts);
        // in order not to break the existing api, files are public by default!
        const encrypted = !!opts.db.encrypted;
        const filePromise = meta.readableFile(name, encrypted);
        const out = new minipass_1.default();
        filePromise.then(prepareStream).catch((err) => out.destroy(err));
        return out;
        async function prepareStream({ stat, contentFeed }) {
            let stream;
            const length = typeof opts.end === 'number' ? 1 + opts.end - (opts.start || 0) : typeof opts.length === 'number' ? opts.length : -1;
            stream = hypercore_byte_stream_1.default(Object.assign(Object.assign({}, opts), { highWaterMark: opts.highWaterMark || 64 * 1024 }));
            stream.on('error', (err) => out.destroy(err));
            stream.pipe(out);
            stream.start({
                feed: contentFeed,
                blockOffset: stat.offset,
                blockLength: stat.blocks,
                byteOffset: opts.start ? stat.byteOffset + opts.start : length === -1 ? -1 : stat.byteOffset,
                byteLength: Math.min(length, stat.size)
            });
            return stream;
        }
    }
    function createWriteStream(name, opts) {
        name = unixify_1.default(name);
        opts = fixOpts(opts);
        // in order not to break the existing api, files are public by default!
        const encrypted = !!opts.db.encrypted;
        const dbOpts = encrypted ? { encrypted: true, hidden: true } : undefined;
        opts.db = dbOpts;
        const input = new minipass_1.default();
        const state = meta
            .writeableFile(name, encrypted)
            .then(prepareStream)
            .catch((err) => input.destroy(err));
        drive.once('appending', async (filename) => {
            const { path, fkey, stream } = await state;
            if (filename !== path)
                throw new Error('appending name !== filename');
            const passedOpts = { trie: true, db: dbOpts };
            drive.stat(path, passedOpts, async (err, stat, trie) => {
                if (err && err.errno !== 2)
                    return input.destroy(err);
                drive._getContent(trie.feed, async (err, contentState) => {
                    if (err)
                        return input.destroy(err);
                    const contentFeedId = contentState.feed.key.toString('hex');
                    if (encrypted) {
                        crypto.registerKey(fkey, { feed: contentFeedId, type: certacrypt_crypto_1.Cipher.ChaCha20_Stream, index: contentState.feed.length });
                    }
                    else {
                        crypto.registerPublic(contentFeedId, contentState.feed.length);
                    }
                    input.pipe(stream);
                });
            });
        });
        // TODO: delete graph vertex on error
        return input;
        function prepareStream(state) {
            const stream = oldCreateWriteStream.call(drive, state.path, opts);
            stream.on('error', (err) => input.destroy(err));
            input.on('error', (err) => stream.destroy(err));
            return Object.assign(Object.assign({}, state), { stream });
        }
    }
    function lstat(name, opts, cb) {
        name = unixify_1.default(name);
        opts = fixOpts(opts);
        if (!opts.resolve) {
            return oldLstat.call(drive, name, opts, cb);
        }
        else {
            return meta
                .find(name)
                .then(async ({ path, feed }) => {
                const feedTrie = await meta.getTrie(feed);
                const { stat, trie } = await meta.lstat(path, !!opts.db.encrypted, feedTrie, !!opts.file);
                cb(null, stat, trie);
                return stat;
            })
                .catch((err) => cb(err));
        }
    }
    async function readdir(name, opts, cb) {
        name = unixify_1.default(name);
        opts = fixOpts(opts);
        const encrypted = opts.db.encrypted;
        if (!encrypted)
            return oldReaddir.call(drive, name, opts, cb);
        const results = new Array();
        for (const vertex of await graph.queryPathAtVertex(name, root).generator().destruct(onError)) {
            const labels = distinct(vertex.getEdges().map((edge) => edge.label));
            const children = (await Promise.all(labels
                .map((label) => {
                let path;
                if (name.endsWith('/'))
                    path = name + label;
                else
                    path = name + '/' + label;
                return { path, label };
            })
                .map(async ({ path, label }) => {
                try {
                    const file = await meta.readableFile(path);
                    if (!file || !file.stat)
                        return null; // might be a thombstone
                    return { label, path, stat: file.stat };
                }
                catch (err) {
                    onError(err);
                    return null;
                }
            }))).filter((child) => child !== null);
            for (const child of children) {
                if (opts.includeStats) {
                    results.push({ name: child.label, path: child.path, stat: child.stat });
                }
                else {
                    results.push(child.label);
                }
            }
        }
        return cb(null, results);
        function onError(err) {
            console.error(`Error on readdir ${name}:\n${err.name}: ${err.message}\n${err.stack ? err.stack : '(no stacktrace available)'}`);
        }
    }
    function mkdir(name, opts, cb) {
        name = unixify_1.default(name);
        opts = fixOpts(opts);
        const encrypted = opts.db.encrypted;
        if (!encrypted)
            return oldMkdir.call(drive, name, opts, cb);
        meta
            .createDirectory(name, (fileid, mkdirCb) => oldMkdir.call(drive, fileid, { db: { encrypted: true } }, mkdirCb))
            .then((v) => cb(null, v))
            .catch((err) => cb(err));
    }
    async function unlink(name, opts, cb) {
        if (typeof opts === 'function')
            return unlink(name, undefined, opts);
        name = unixify_1.default(name);
        opts = fixOpts(opts);
        const encrypted = opts.db.encrypted;
        if (!encrypted)
            return oldUnlink.call(drive, name, cb);
        await meta.unlink(name);
        if (cb)
            cb();
    }
}
exports.cryptoDrive = cryptoDrive;
function fixOpts(opts) {
    opts = Object.assign({}, opts);
    opts.db = opts.db || {};
    opts.db.encrypted = !!(opts.db.encrypted || opts.encrypted);
    return opts;
}
function distinct(arr) {
    return [...new Set(arr).values()];
}
//# sourceMappingURL=drive.js.map