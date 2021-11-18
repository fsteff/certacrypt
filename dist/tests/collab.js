"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const simulator_1 = __importDefault(require("hyperspace/simulator"));
const tape_1 = __importDefault(require("tape"));
const certacrypt_crypto_1 = require("certacrypt-crypto");
const __1 = require("..");
const debug_1 = require("../lib/debug");
const space_1 = require("../lib/space");
debug_1.enableDebugLogging();
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
    // init users
    const alice = await createCertaCrypt(client);
    const bob = await createCertaCrypt(client);
    const aliceUser = await alice.certacrypt.user;
    const bobUser = await bob.certacrypt.user;
    const appRootAlice = await alice.certacrypt.path('/apps');
    const appRootBob = await bob.certacrypt.path('/apps');
    // preparing alice
    const aliceDriveRoot = alice.certacrypt.graph.create();
    await alice.certacrypt.graph.put(aliceDriveRoot);
    appRootAlice.addEdgeTo(aliceDriveRoot, 'drive');
    await alice.certacrypt.graph.put(appRootAlice);
    const aliceDrive = await alice.certacrypt.drive(aliceDriveRoot);
    await aliceDrive.promises.mkdir('/', encryptedOpts);
    await aliceDrive.promises.mkdir('/space', encryptedOpts);
    await aliceDrive.promises.writeFile('/space/readme.txt', 'Hi, I am Alice', encryptedOpts);
    const aliceSpaceRoot = await alice.certacrypt.path('/apps/drive/space');
    const aliceSpace = await alice.certacrypt.convertToCollaborationSpace(aliceDriveRoot, aliceSpaceRoot);
    const states = await alice.certacrypt.graph.queryPathAtVertex('/space/readme.txt', aliceDriveRoot).states();
    t.same(states.length, 1);
    t.ok(states[0] instanceof space_1.SpaceQueryState);
    t.ok(states[0].space.root.equals(aliceSpaceRoot));
});
//# sourceMappingURL=collab.js.map