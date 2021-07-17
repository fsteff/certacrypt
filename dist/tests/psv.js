"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const simulator_1 = __importDefault(require("hyperspace/simulator"));
const tape_1 = __importDefault(require("tape"));
const certacrypt_crypto_1 = require("certacrypt-crypto");
const __1 = require("..");
const hyper_graphdb_1 = require("hyper-graphdb");
async function createCertaCrypt(client) {
    const store = client.corestore();
    await store.ready();
    const crypto = new certacrypt_crypto_1.DefaultCrypto();
    const certacrypt = new __1.CertaCrypt(store, crypto);
    return { store, crypto, certacrypt };
}
tape_1.default('preshared vertex', async (t) => {
    const { client, server, cleanup } = await simulator_1.default();
    await client.ready();
    const alice = await createCertaCrypt(client);
    const bob = await createCertaCrypt(client);
    const aliceUser = await alice.certacrypt.user;
    const bobUser = await bob.certacrypt.user;
    const appRootAlice = await alice.certacrypt.path('/apps');
    const appRootBob = await bob.certacrypt.path('/apps');
    const aliceSpace = alice.certacrypt.graph.create();
    aliceSpace.setContent(new hyper_graphdb_1.SimpleGraphObject().set('hello', 'I am Alice'));
    await alice.certacrypt.graph.put(aliceSpace);
    appRootAlice.addEdgeTo(aliceSpace, 'space');
    await alice.certacrypt.graph.put(appRootAlice);
    const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl());
    await bobSeenFromAlice.referToPresharedVertex(aliceSpace, '.');
    const edge = aliceSpace.getEdges('.')[0];
    bob.crypto.registerKey(alice.certacrypt.graph.getKey(aliceSpace), { index: aliceSpace.getId(), feed: aliceSpace.getFeed(), type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
    const bobSpace = await bobUser.writeToPresharedVertex(edge);
    bobSpace.setContent(new hyper_graphdb_1.SimpleGraphObject().set('hello', 'I am Bob'));
    bobSpace.addEdgeTo(aliceSpace, '.');
    appRootBob.addEdgeTo(bobSpace, 'space');
    await bob.certacrypt.graph.put([bobSpace, appRootBob]);
    const resultSpaceFromAlice = await alice.certacrypt.graph.queryPathAtVertex('/space/.', appRootAlice).vertices();
    const resultSpaceFromBob = await bob.certacrypt.graph.queryPathAtVertex('/space/.', appRootBob).vertices();
    t.ok(resultSpaceFromAlice.length > 0);
    t.ok(resultSpaceFromBob.length > 0);
    t.ok(resultSpaceFromAlice[0].equals(bobSpace));
    t.ok(resultSpaceFromBob[0].equals(aliceSpace));
    cleanup();
    t.end();
});
//# sourceMappingURL=psv.js.map