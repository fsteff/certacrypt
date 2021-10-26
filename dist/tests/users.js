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
const graphObjects_1 = require("../lib/graphObjects");
//enableDebugLogging()
const encryptedOpts = { db: { encrypted: true }, encoding: 'utf-8' };
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
tape_1.default('contacts', async (t) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const { client, server, cleanup } = await simulator_1.default();
    await client.ready();
    // init users
    const alice = await createCertaCrypt(client);
    const bob = await createCertaCrypt(client);
    const caesar = await createCertaCrypt(client);
    const aliceUser = await alice.certacrypt.user;
    const bobUser = await bob.certacrypt.user;
    const caesarUser = await caesar.certacrypt.user;
    const aliceProfile = new graphObjects_1.UserProfile();
    aliceProfile.username = 'Alice';
    await aliceUser.setProfile(aliceProfile);
    t.equals((_a = (await aliceUser.getProfile())) === null || _a === void 0 ? void 0 : _a.username, 'Alice');
    const bobProfile = new graphObjects_1.UserProfile();
    bobProfile.username = 'Bob';
    await bobUser.setProfile(bobProfile);
    t.equals((_b = (await bobUser.getProfile())) === null || _b === void 0 ? void 0 : _b.username, 'Bob');
    const caesarProfile = new graphObjects_1.UserProfile();
    caesarProfile.username = 'Caesar';
    await caesarUser.setProfile(caesarProfile);
    t.equals((_c = (await caesarUser.getProfile())) === null || _c === void 0 ? void 0 : _c.username, 'Caesar');
    const aliceSeenFromBob = await bob.certacrypt.getUserByUrl(aliceUser.getPublicUrl());
    t.equals((_d = (await aliceSeenFromBob.getProfile())) === null || _d === void 0 ? void 0 : _d.username, 'Alice');
    const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl());
    t.equals((_e = (await bobSeenFromAlice.getProfile())) === null || _e === void 0 ? void 0 : _e.username, 'Bob');
    const caesarSeenFromAlice = await alice.certacrypt.getUserByUrl(caesarUser.getPublicUrl());
    t.equals((_f = (await caesarSeenFromAlice.getProfile())) === null || _f === void 0 ? void 0 : _f.username, 'Caesar');
    const caesarSeenFromBob = await bob.certacrypt.getUserByUrl(caesarUser.getPublicUrl());
    t.equals((_g = (await caesarSeenFromBob.getProfile())) === null || _g === void 0 ? void 0 : _g.username, 'Caesar');
    // -------------- check actual communication -----------------------------
    const aliceContacts = await alice.certacrypt.contacts;
    t.equals((_h = (await aliceSeenFromBob.getProfile())) === null || _h === void 0 ? void 0 : _h.username, 'Alice');
    await aliceContacts.addFriend(caesarSeenFromAlice);
    t.equals((_j = (await aliceSeenFromBob.getProfile())) === null || _j === void 0 ? void 0 : _j.username, 'Alice');
    await aliceContacts.addFriend(bobSeenFromAlice);
    t.equals((_k = (await aliceSeenFromBob.getProfile())) === null || _k === void 0 ? void 0 : _k.username, 'Alice');
    const bobContacts = await bob.certacrypt.contacts;
    await bobContacts.addFriend(aliceSeenFromBob);
    t.equals(await bobContacts.getFriendState(aliceSeenFromBob), contacts_1.FriendState.FRIENDS);
    const contacts = await bobContacts.getAllContacts();
    t.equals(contacts.length, 2);
    t.equals(contacts.map((c) => c.username).join(', '), ['Alice', 'Caesar'].join(', '));
    cleanup();
    t.end();
});
tape_1.default('shares', async (t) => {
    var _a, _b, _c, _d;
    const { client, server, cleanup } = await simulator_1.default();
    await client.ready();
    // init users
    const alice = await createCertaCrypt(client);
    const bob = await createCertaCrypt(client);
    const aliceUser = await alice.certacrypt.user;
    const bobUser = await bob.certacrypt.user;
    const aliceProfile = new graphObjects_1.UserProfile();
    aliceProfile.username = 'Alice';
    await aliceUser.setProfile(aliceProfile);
    t.equals((_a = (await aliceUser.getProfile())) === null || _a === void 0 ? void 0 : _a.username, 'Alice');
    const bobProfile = new graphObjects_1.UserProfile();
    bobProfile.username = 'Bob';
    await bobUser.setProfile(bobProfile);
    t.equals((_b = (await bobUser.getProfile())) === null || _b === void 0 ? void 0 : _b.username, 'Bob');
    const aliceSeenFromBob = await bob.certacrypt.getUserByUrl(aliceUser.getPublicUrl());
    t.equals((_c = (await aliceSeenFromBob.getProfile())) === null || _c === void 0 ? void 0 : _c.username, 'Alice');
    const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl());
    t.equals((_d = (await bobSeenFromAlice.getProfile())) === null || _d === void 0 ? void 0 : _d.username, 'Bob');
    // -------------- check actual communication -----------------------------
    const aliceContacts = await alice.certacrypt.contacts;
    await aliceContacts.addFriend(bobSeenFromAlice);
    const bobContacts = await bob.certacrypt.contacts;
    await bobContacts.addFriend(aliceSeenFromBob);
    t.equals(await bobContacts.getFriendState(aliceSeenFromBob), contacts_1.FriendState.FRIENDS);
    const aliceHome = alice.certacrypt.graph.create();
    aliceHome.setContent(new graphObjects_1.Directory());
    await alice.certacrypt.graph.put(aliceHome);
    const aliceAppRoot = await alice.certacrypt.path('/apps');
    aliceAppRoot.addEdgeTo(aliceHome, 'home');
    await alice.certacrypt.graph.put(aliceAppRoot);
    const share = await alice.certacrypt.createShare(aliceHome);
    await alice.certacrypt.sendShare(share, [bobSeenFromAlice]);
    const bobShares = await bobContacts.getAllReceivedShares();
    t.equals(bobShares.length, 1);
    t.true(bobShares[0].share.equals(share));
    t.true(bobShares[0].target.equals(aliceHome));
    t.equals(bobShares[0].sharedBy, aliceUser.getPublicUrl());
    const aliceSentShares = await aliceContacts.getAllSentShares();
    t.equals(aliceSentShares.length, 1);
    t.true(aliceSentShares[0].share.equals(share));
    t.true(aliceSentShares[0].target.equals(aliceHome));
    t.equals(aliceSentShares[0].sharedWith.length, 1);
    t.equals(aliceSentShares[0].sharedWith[0], bobUser.getPublicUrl());
    cleanup();
    t.end();
});
//# sourceMappingURL=users.js.map