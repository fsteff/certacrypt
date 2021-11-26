"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const simulator_1 = __importDefault(require("hyperspace/simulator"));
const tape_1 = __importDefault(require("tape"));
const certacrypt_crypto_1 = require("certacrypt-crypto");
const __1 = require("..");
const space_1 = require("../lib/space");
const certacrypt_graph_1 = require("certacrypt-graph");
//enableDebugLogging()
const encryptedOpts = { db: { encrypted: true }, encoding: 'utf-8' };
async function createCertaCrypt(client) {
    const store = client.corestore();
    await store.ready();
    const crypto = new certacrypt_crypto_1.DefaultCrypto();
    const certacrypt = new __1.CertaCrypt(store, crypto);
    return { store, crypto, certacrypt };
}
tape_1.default('write to collaboration space', async (t) => {
    const { client, server, cleanup } = await simulator_1.default();
    await client.ready();
    t.teardown(cleanup);
    // init users
    const alice = await createCertaCrypt(client);
    const bob = await createCertaCrypt(client);
    const aliceUser = await alice.certacrypt.user;
    const bobUser = await bob.certacrypt.user;
    const aliceSeenFromBob = await bob.certacrypt.getUserByUrl(aliceUser.getPublicUrl());
    const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl());
    await (await alice.certacrypt.contacts).addFriend(bobSeenFromAlice);
    await (await bob.certacrypt.contacts).addFriend(aliceSeenFromBob);
    // preparing alice
    const appRootAlice = await alice.certacrypt.path('/apps');
    let aliceDriveRoot = alice.certacrypt.graph.create();
    await alice.certacrypt.graph.put(aliceDriveRoot);
    appRootAlice.addEdgeTo(aliceDriveRoot, 'drive');
    await alice.certacrypt.graph.put(appRootAlice);
    const aliceDrive = await alice.certacrypt.drive(aliceDriveRoot);
    await aliceDrive.promises.mkdir('/', encryptedOpts);
    await aliceDrive.promises.mkdir('/space', encryptedOpts);
    await aliceDrive.promises.writeFile('/space/readme.txt', 'Hi, I am Alice', encryptedOpts);
    // convert to space
    aliceDriveRoot = await aliceDrive.updateRoot();
    const aliceSpace = await alice.certacrypt.convertToCollaborationSpace('/apps/drive/space');
    aliceDriveRoot = await aliceDrive.updateRoot();
    // preparing bob
    const appRootBob = await bob.certacrypt.path('/apps');
    const bobDriveRoot = bob.certacrypt.graph.create();
    await bob.certacrypt.graph.put(bobDriveRoot);
    appRootBob.addEdgeTo(bobDriveRoot, 'drive');
    await bob.certacrypt.graph.put(appRootBob);
    const bobDrive = await bob.certacrypt.drive(bobDriveRoot);
    await bobDrive.promises.mkdir('/', encryptedOpts);
    // test if the converted directory queries work
    let states = await alice.certacrypt.graph.queryPathAtVertex('/space/readme.txt', aliceDriveRoot).states();
    t.same(states.length, 1);
    t.ok(states[0] instanceof space_1.SpaceQueryState);
    t.ok(states[0].space.root.equals(aliceSpace.root));
    // test write & read of owned space
    await aliceDrive.promises.writeFile('/space/readme2.txt', 'Hi, I am Alice, #2', encryptedOpts);
    let readme = await aliceDrive.promises.readFile('/space/readme2.txt', encryptedOpts);
    t.same(readme, 'Hi, I am Alice, #2');
    let files = await aliceDrive.promises.readdir('/space', encryptedOpts);
    t.same(files, ['readme.txt', 'readme2.txt']);
    // share with bob
    const sharedSpace = await alice.certacrypt.createShare(aliceSpace.root);
    await alice.certacrypt.sendShare(sharedSpace, [bobSeenFromAlice]);
    await aliceSpace.addWriter(bobSeenFromAlice);
    const bobShares = await (await bob.certacrypt.contacts).getAllReceivedShares();
    t.same(bobShares.length, 1);
    const bobShare = bobShares[0].share;
    bobDriveRoot.addEdgeTo(bobShare, 'alice', { view: certacrypt_graph_1.SHARE_VIEW });
    await bob.certacrypt.graph.put(bobDriveRoot);
    readme = await bobDrive.promises.readFile('/alice/readme.txt', encryptedOpts);
    t.same(readme, 'Hi, I am Alice');
    // test write access
    await bobDrive.promises.mkdir('/alice/bobs/', encryptedOpts);
    files = await bobDrive.promises.readdir('/alice', encryptedOpts);
    t.same(files, ['readme.txt', 'readme2.txt', 'bobs']);
    files = await aliceDrive.promises.readdir('/space', encryptedOpts);
    t.same(files, ['readme.txt', 'readme2.txt', 'bobs']);
    await bobDrive.promises.writeFile('/alice/bobs/hello.txt', 'Hello, I am Bob', encryptedOpts);
    let helloFile = await bobDrive.promises.readFile('/alice/bobs/hello.txt', encryptedOpts);
    t.same(helloFile, 'Hello, I am Bob');
    helloFile = await aliceDrive.promises.readFile('/space/bobs/hello.txt', encryptedOpts);
    t.same(helloFile, 'Hello, I am Bob');
    // test conflicts
    await bobDrive.promises.writeFile('/alice/readme.txt', 'Hehe, I overwrote it', encryptedOpts);
    states = await bob.certacrypt.graph.queryPathAtVertex('/alice/readme.txt', await bobDrive.updateRoot()).states();
    t.same(states.length, 2);
    readme = await bobDrive.promises.readFile('/alice/readme.txt', encryptedOpts);
    t.same(readme, 'Hehe, I overwrote it');
    // check readdir stat results for writers
    let stats = (await aliceDrive.promises.readdir('/space', Object.assign(Object.assign({}, encryptedOpts), { includeStats: true })));
    t.ok(stats[0].space);
    t.same(stats[0].space.writers, [aliceUser.getPublicUrl(), bobUser.getPublicUrl()]);
    stats = (await bobDrive.promises.readdir('/alice/bobs', Object.assign(Object.assign({}, encryptedOpts), { includeStats: true })));
    t.ok(stats[0].space);
    t.same(stats[0].space.writers, [aliceUser.getPublicUrl(), bobUser.getPublicUrl()]);
    // test deletion
    await aliceDrive.promises.unlink('/space/bobs', encryptedOpts);
    files = await bobDrive.promises.readdir('/alice', encryptedOpts);
    t.same(files, ['readme.txt', 'readme2.txt']);
    files = await aliceDrive.promises.readdir('/space', encryptedOpts);
    t.same(files, ['readme.txt', 'readme2.txt']);
});
//# sourceMappingURL=collab.js.map