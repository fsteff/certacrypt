"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const drive_1 = require("../lib/drive");
const graphObjects_1 = require("../lib/graphObjects");
const random_access_memory_1 = __importDefault(require("random-access-memory"));
const corestore_1 = __importDefault(require("corestore"));
const tape_1 = __importDefault(require("tape"));
const certacrypt_graph_1 = require("certacrypt-graph");
const certacrypt_crypto_1 = require("certacrypt-crypto");
const encryptedOpts = { db: { encrypted: true }, encoding: 'utf-8' };
async function createDB() {
    const store = new corestore_1.default(random_access_memory_1.default);
    await store.ready();
    const crypto = new certacrypt_crypto_1.DefaultCrypto();
    const db = new certacrypt_graph_1.CertaCryptGraph(store, null, crypto);
    db.codec.registerImpl(data => new graphObjects_1.File(data));
    db.codec.registerImpl(data => new graphObjects_1.Directory(data));
    return { store, crypto, db };
}
tape_1.default('write and read', async (t) => {
    const { store, crypto, db } = await createDB();
    const v1 = db.create();
    await db.put(v1);
    const drive = await drive_1.cryptoDrive(store, db, crypto, v1);
    await drive.promises.writeFile('test.txt', 'hello world', encryptedOpts);
    let content = await drive.promises.readFile('test.txt', encryptedOpts);
    t.same(content, 'hello world');
    await drive.promises.writeFile('/subdir/test.txt', 'hello there', encryptedOpts);
    content = await drive.promises.readFile('/subdir/test.txt', encryptedOpts);
    t.same(content, 'hello there');
});
tape_1.default('public', async (t) => {
    const { store, crypto, db } = await createDB();
    const v1 = db.create();
    await db.put(v1);
    const drive = await drive_1.cryptoDrive(store, db, crypto, v1);
    await drive.promises.writeFile('test.txt', 'hello world', 'utf-8');
    const content = await drive.promises.readFile('test.txt', 'utf-8');
    t.same(content, 'hello world');
});
tape_1.default('2 DBs', async (t) => {
    const store = new corestore_1.default(random_access_memory_1.default);
    await store.ready();
    const crypto = new certacrypt_crypto_1.DefaultCrypto();
    const crypto2 = new certacrypt_crypto_1.DefaultCrypto();
    const db = new certacrypt_graph_1.CertaCryptGraph(store.namespace('1'), null, crypto);
    const db2 = new certacrypt_graph_1.CertaCryptGraph(store.namespace('2'), null, crypto2);
    db.codec.registerImpl(data => new graphObjects_1.File(data));
    db.codec.registerImpl(data => new graphObjects_1.Directory(data));
    db2.codec.registerImpl(data => new graphObjects_1.File(data));
    db2.codec.registerImpl(data => new graphObjects_1.Directory(data));
    const v1 = db.create();
    await db.put(v1);
    const v2 = db2.create();
    v2.addEdgeTo(v1, 'mount');
    crypto2.registerKey(db.getKey(v1), { feed: v1.getFeed(), index: v1.getId(), type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
    await db2.put(v2);
    const drive = await drive_1.cryptoDrive(store.namespace('d1'), db, crypto, v1);
    await drive.promises.writeFile('test.txt', 'hello world', encryptedOpts);
    const drive2 = await drive_1.cryptoDrive(store.namespace('d2'), db2, crypto2, v2);
    const content = await drive2.promises.readFile('/mount/test.txt', encryptedOpts);
    t.same(content, 'hello world');
});
tape_1.default('readdir', async (t) => {
    const { store, crypto, db } = await createDB();
    const v1 = db.create();
    await db.put(v1);
    const drive = await drive_1.cryptoDrive(store, db, crypto, v1);
    await drive.promises.writeFile('docs/test.txt', 'hello world', encryptedOpts);
    const content = await drive.promises.readFile('docs/test.txt', encryptedOpts);
    t.same(content, 'hello world');
    let results = await drive.promises.readdir('docs', Object.assign(Object.assign({}, encryptedOpts), { includeStats: true }));
    t.same(results.length, 1);
    const first = results[0];
    t.same(first.name, 'test.txt');
    t.same(first.path, 'docs/test.txt');
    results = await drive.promises.readdir('docs', Object.assign(Object.assign({}, encryptedOpts), { includeStats: false }));
    t.same(results, ['test.txt']);
});
tape_1.default('mkdir', async (t) => {
    const { store, crypto, db } = await createDB();
    const v1 = db.create();
    await db.put(v1);
    const drive = await drive_1.cryptoDrive(store, db, crypto, v1);
    await drive.promises.mkdir('docs', encryptedOpts);
    await drive.promises.writeFile('docs/test.txt', 'hello world', encryptedOpts);
    const content = await drive.promises.readFile('docs/test.txt', encryptedOpts);
    t.same(content, 'hello world');
    const dir = await drive.promises.lstat('docs', { resolve: true });
    t.ok(dir && typeof dir === 'object');
});
//# sourceMappingURL=basic.js.map