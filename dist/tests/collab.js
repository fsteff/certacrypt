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
    const aliceDriveRoot = alice.certacrypt.graph.create();
    await alice.certacrypt.graph.put(aliceDriveRoot);
    appRootAlice.addEdgeTo(aliceDriveRoot, 'drive');
    await alice.certacrypt.graph.put(appRootAlice);
    const aliceDrive = await alice.certacrypt.drive(aliceDriveRoot);
    await aliceDrive.promises.mkdir('/', encryptedOpts);
    await aliceDrive.promises.mkdir('/space', encryptedOpts);
    await aliceDrive.promises.writeFile('/space/readme.txt', 'Hi, I am Alice', encryptedOpts);
    // conbert to space
    const aliceSpaceRoot = await alice.certacrypt.path('/apps/drive/space');
    const aliceSpace = await alice.certacrypt.convertToCollaborationSpace(aliceDriveRoot, aliceSpaceRoot);
    // preparing bob
    const appRootBob = await bob.certacrypt.path('/apps');
    const bobDriveRoot = bob.certacrypt.graph.create();
    await bob.certacrypt.graph.put(bobDriveRoot);
    appRootBob.addEdgeTo(bobDriveRoot, 'drive');
    await bob.certacrypt.graph.put(appRootBob);
    const bobDrive = await bob.certacrypt.drive(bobDriveRoot);
    await bobDrive.promises.mkdir('/', encryptedOpts);
    // test if the converted directory queries work
    const states = await alice.certacrypt.graph.queryPathAtVertex('/space/readme.txt', aliceDriveRoot).states();
    t.same(states.length, 1);
    t.ok(states[0] instanceof space_1.SpaceQueryState);
    t.ok(states[0].space.root.equals(aliceSpace.root));
    // test write & read of owned space
    await aliceDrive.promises.writeFile('/space/readme2.txt', 'Hi, I am Alice, #2', encryptedOpts);
    const readme = await aliceDrive.promises.readFile('/space/readme2.txt', encryptedOpts);
    t.same(readme, 'Hi, I am Alice, #2');
    // test write access
    const sharedSpace = await alice.certacrypt.createShare(aliceSpace.root);
    await alice.certacrypt.sendShare(sharedSpace, [bobSeenFromAlice]);
    await aliceSpace.addWriter(bobSeenFromAlice);
    const bobShares = await (await bob.certacrypt.contacts).getAllReceivedShares();
    t.same(bobShares.length, 1);
    const bobShare = bobShares[0].target;
    // TODO: .getAllReceivedShares() already follows the space '.' edges - how to circumvent that?
    t.ok(bobShare.getId() === aliceSpace.root.getId() && bobShare.getFeed() === aliceSpace.root.getFeed());
});
//# sourceMappingURL=collab.js.map