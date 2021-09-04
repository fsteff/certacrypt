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
const communication_1 = require("../lib/communication");
const contacts_1 = require("../lib/contacts");
async function createCertaCrypt(client) {
    const store = client.corestore();
    await store.ready();
    const crypto = new certacrypt_crypto_1.DefaultCrypto();
    const certacrypt = new __1.CertaCrypt(store, crypto);
    return { store, crypto, certacrypt };
}
tape_1.default('preshared vertex & inbox', async (t) => {
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
    const aliceSpace = alice.certacrypt.graph.create();
    aliceSpace.setContent(new hyper_graphdb_1.SimpleGraphObject().set('hello', 'I am Alice'));
    await alice.certacrypt.graph.put(aliceSpace);
    appRootAlice.addEdgeTo(aliceSpace, 'space');
    await alice.certacrypt.graph.put(appRootAlice);
    // refer to bob's preshared vertex
    const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl());
    await bobSeenFromAlice.referToPresharedVertex(aliceSpace, '.');
    const edge = aliceSpace.getEdges('.')[0];
    // send bob an envelope containing the key to aliceSpace
    const aliceInbox = await aliceUser.getInbox();
    await aliceInbox.postEnvelope(aliceSpace, bobSeenFromAlice);
    // bob's turn
    // get alice's message adressed to bob
    const aliceSeenFromBob = await bob.certacrypt.getUserByUrl(aliceUser.getPublicUrl());
    const aliceInboxSeenFromBob = await aliceSeenFromBob.getInbox();
    const envelopes = await aliceInboxSeenFromBob.checkEnvelopes();
    t.equals(envelopes.length, 1);
    // alice sent her space to bob's inbox
    const aliceSpaceSeenFromBob = envelopes[0];
    // bob refers to alice itself
    const bobSpace = await bobUser.writeToPresharedVertex(edge);
    bobSpace.setContent(new hyper_graphdb_1.SimpleGraphObject().set('hello', 'I am Bob'));
    bobSpace.addEdgeTo(aliceSpaceSeenFromBob, '.');
    appRootBob.addEdgeTo(bobSpace, 'space');
    await bob.certacrypt.graph.put([bobSpace, appRootBob]);
    // check results
    const resultSpaceFromAlice = await alice.certacrypt.graph.queryPathAtVertex('/space/.', appRootAlice).vertices();
    const resultSpaceFromBob = await bob.certacrypt.graph.queryPathAtVertex('/space/.', appRootBob).vertices();
    t.ok(resultSpaceFromAlice.length > 0);
    t.ok(resultSpaceFromBob.length > 0);
    t.ok(resultSpaceFromAlice[0].equals(bobSpace));
    t.ok(resultSpaceFromBob[0].equals(aliceSpace));
    cleanup();
    t.end();
});
tape_1.default('communication', async (t) => {
    const { client, server, cleanup } = await simulator_1.default();
    await client.ready();
    // init users
    const alice = await createCertaCrypt(client);
    const bob = await createCertaCrypt(client);
    const aliceUser = await alice.certacrypt.user;
    const bobUser = await bob.certacrypt.user;
    const aliceSeenFromBob = await bob.certacrypt.getUserByUrl(aliceUser.getPublicUrl());
    const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl());
    const aliceComm = await communication_1.Communication.InitUserCommunication(alice.certacrypt.graph, await alice.certacrypt.socialRoot, await alice.certacrypt.cacheDb, aliceUser, bobSeenFromAlice);
    const bobComm = await communication_1.Communication.InitUserCommunication(bob.certacrypt.graph, await bob.certacrypt.socialRoot, await bob.certacrypt.cacheDb, bobUser, aliceSeenFromBob);
    // ------------ check if communication setup works ----------------------
    const aliceInbox = await aliceSeenFromBob.getInbox();
    const bobInbox = await bobSeenFromAlice.getInbox();
    const aliceSent = await aliceInbox.checkEnvelopes();
    const bobSent = await bobInbox.checkEnvelopes();
    t.equals(aliceSent.length, 1);
    t.equals(bobSent.length, 1);
    const aliceInit = await aliceComm.checkInbox(bobSeenFromAlice);
    const bobInit = await bobComm.checkInbox(aliceSeenFromBob);
    t.equals(aliceInit.length, 1);
    t.equals(bobInit.length, 0); // already got that in InitUserCommunication
    const aliceParticipants = await aliceComm.getParticipants();
    const bobParticipants = await bobComm.getParticipants();
    t.equals(aliceParticipants.length, 1);
    t.equals(bobParticipants.length, 1);
    // -------------- check actual communication -----------------------------
    const aliceContacts = await alice.certacrypt.contacts;
    await aliceContacts.addFriend(bobSeenFromAlice);
    t.equals(await aliceContacts.getFriendState(bobSeenFromAlice), contacts_1.FriendState.REQUEST_SENT);
    const bobContacts = await bob.certacrypt.contacts;
    t.equals(await bobContacts.getFriendState(aliceSeenFromBob), contacts_1.FriendState.REQUEST_RECEIVED);
    await bobContacts.addFriend(aliceSeenFromBob);
    t.equals(await aliceContacts.getFriendState(bobSeenFromAlice), contacts_1.FriendState.FRIENDS);
    t.equals(await bobContacts.getFriendState(aliceSeenFromBob), contacts_1.FriendState.FRIENDS);
    cleanup();
    t.end();
});
//# sourceMappingURL=users.js.map