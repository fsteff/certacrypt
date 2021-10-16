import simulator from 'hyperspace/simulator'
import tape from 'tape'
import { Cipher, DefaultCrypto } from 'certacrypt-crypto'
import { CertaCrypt } from '..'
import { ReferrerEdge } from '../lib/referrer'
import { SimpleGraphObject, Vertex } from 'hyper-graphdb'
import { Communication } from '../lib/communication'
import { FriendState } from '../lib/contacts'
import { Directory, UserProfile } from '../lib/graphObjects'
import { enableDebugLogging } from '../lib/debug'

//enableDebugLogging()
const encryptedOpts = { db: { encrypted: true }, encoding: 'utf-8' }

async function createCertaCrypt(client) {
  const store = client.corestore()
  await store.ready()
  const crypto = new DefaultCrypto()
  const certacrypt = new CertaCrypt(store, crypto)
  return { store, crypto, certacrypt }
}

tape('preshared vertex & inbox', async (t) => {
  const { client, server, cleanup } = await simulator()
  await client.ready()

  // init users
  const alice = await createCertaCrypt(client)
  const bob = await createCertaCrypt(client)

  const aliceUser = await alice.certacrypt.user
  const bobUser = await bob.certacrypt.user

  const appRootAlice = await alice.certacrypt.path('/apps')
  const appRootBob = await bob.certacrypt.path('/apps')

  // preparing alice
  const aliceSpace = alice.certacrypt.graph.create<SimpleGraphObject>()
  aliceSpace.setContent(new SimpleGraphObject().set('hello', 'I am Alice'))
  await alice.certacrypt.graph.put(aliceSpace)
  appRootAlice.addEdgeTo(aliceSpace, 'space')
  await alice.certacrypt.graph.put(appRootAlice)

  // refer to bob's preshared vertex
  const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl())
  await bobSeenFromAlice.referToPresharedVertex(aliceSpace, '.')
  const edge = <ReferrerEdge>aliceSpace.getEdges('.')[0]

  // send bob an envelope containing the key to aliceSpace
  const aliceInbox = await aliceUser.getInbox()
  await aliceInbox.postEnvelope(aliceSpace, bobSeenFromAlice)

  // bob's turn
  // get alice's message adressed to bob
  const aliceSeenFromBob = await bob.certacrypt.getUserByUrl(aliceUser.getPublicUrl())
  const aliceInboxSeenFromBob = await aliceSeenFromBob.getInbox()
  const envelopes = await aliceInboxSeenFromBob.checkEnvelopes()
  t.equals(envelopes.length, 1)
  // alice sent her space to bob's inbox
  const aliceSpaceSeenFromBob = envelopes[0]

  // bob refers to alice itself
  const bobSpace = <Vertex<SimpleGraphObject>>await bobUser.writeToPresharedVertex(edge)
  bobSpace.setContent(new SimpleGraphObject().set('hello', 'I am Bob'))
  bobSpace.addEdgeTo(aliceSpaceSeenFromBob, '.')
  appRootBob.addEdgeTo(bobSpace, 'space')
  await bob.certacrypt.graph.put([bobSpace, appRootBob])

  // check results
  const resultSpaceFromAlice = await alice.certacrypt.graph.queryPathAtVertex('/space/.', appRootAlice).vertices()
  const resultSpaceFromBob = await bob.certacrypt.graph.queryPathAtVertex('/space/.', appRootBob).vertices()

  t.ok(resultSpaceFromAlice.length > 0)
  t.ok(resultSpaceFromBob.length > 0)
  t.ok(resultSpaceFromAlice[0].equals(bobSpace))
  t.ok(resultSpaceFromBob[0].equals(aliceSpace))

  cleanup()
  t.end()
})

tape('communication', async (t) => {
  const { client, server, cleanup } = await simulator()
  await client.ready()

  // init users
  const alice = await createCertaCrypt(client)
  const bob = await createCertaCrypt(client)

  const aliceUser = await alice.certacrypt.user
  const bobUser = await bob.certacrypt.user
  const aliceSeenFromBob = await bob.certacrypt.getUserByUrl(aliceUser.getPublicUrl())
  const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl())

  const aliceComm = await Communication.InitUserCommunication(
    alice.certacrypt.graph,
    await alice.certacrypt.socialRoot,
    await alice.certacrypt.cacheDb,
    aliceUser,
    bobSeenFromAlice
  )
  const bobComm = await Communication.InitUserCommunication(
    bob.certacrypt.graph,
    await bob.certacrypt.socialRoot,
    await bob.certacrypt.cacheDb,
    bobUser,
    aliceSeenFromBob
  )

  // ------------ check if communication setup works ----------------------
  const aliceInbox = await aliceSeenFromBob.getInbox()
  const bobInbox = await bobSeenFromAlice.getInbox()
  const aliceSent = await aliceInbox.checkEnvelopes()
  const bobSent = await bobInbox.checkEnvelopes()
  t.equals(aliceSent.length, 1)
  t.equals(bobSent.length, 1)

  const aliceInit = await aliceComm.checkInbox(bobSeenFromAlice)
  const bobInit = await bobComm.checkInbox(aliceSeenFromBob)
  t.equals(aliceInit.length, 1)
  t.equals(bobInit.length, 0) // already got that in InitUserCommunication

  const aliceParticipants = await aliceComm.getParticipants()
  const bobParticipants = await bobComm.getParticipants()
  t.equals(aliceParticipants.length, 1)
  t.equals(bobParticipants.length, 1)

  // -------------- check actual communication -----------------------------

  const aliceContacts = await alice.certacrypt.contacts
  await aliceContacts.addFriend(bobSeenFromAlice)
  t.equals(await aliceContacts.getFriendState(bobSeenFromAlice), FriendState.REQUEST_SENT)

  const bobContacts = await bob.certacrypt.contacts
  t.equals(await bobContacts.getFriendState(aliceSeenFromBob), FriendState.REQUEST_RECEIVED)
  await bobContacts.addFriend(aliceSeenFromBob)

  t.equals(await aliceContacts.getFriendState(bobSeenFromAlice), FriendState.FRIENDS)
  t.equals(await bobContacts.getFriendState(aliceSeenFromBob), FriendState.FRIENDS)

  cleanup()
  t.end()
})

tape('contacts', async (t) => {
  const { client, server, cleanup } = await simulator()
  await client.ready()

  // init users
  const alice = await createCertaCrypt(client)
  const bob = await createCertaCrypt(client)
  const caesar = await createCertaCrypt(client)

  const aliceUser = await alice.certacrypt.user
  const bobUser = await bob.certacrypt.user
  const caesarUser = await caesar.certacrypt.user

  const aliceProfile = new UserProfile()
  aliceProfile.username = 'Alice'
  await aliceUser.setProfile(aliceProfile)
  t.equals((await aliceUser.getProfile())?.username, 'Alice')

  const bobProfile = new UserProfile()
  bobProfile.username = 'Bob'
  await bobUser.setProfile(bobProfile)
  t.equals((await bobUser.getProfile())?.username, 'Bob')

  const caesarProfile = new UserProfile()
  caesarProfile.username = 'Caesar'
  await caesarUser.setProfile(caesarProfile)
  t.equals((await caesarUser.getProfile())?.username, 'Caesar')

  const aliceSeenFromBob = await bob.certacrypt.getUserByUrl(aliceUser.getPublicUrl())
  t.equals((await aliceSeenFromBob.getProfile())?.username, 'Alice')
  const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl())
  t.equals((await bobSeenFromAlice.getProfile())?.username, 'Bob')
  const caesarSeenFromAlice = await alice.certacrypt.getUserByUrl(caesarUser.getPublicUrl())
  t.equals((await caesarSeenFromAlice.getProfile())?.username, 'Caesar')
  const caesarSeenFromBob = await bob.certacrypt.getUserByUrl(caesarUser.getPublicUrl())
  t.equals((await caesarSeenFromBob.getProfile())?.username, 'Caesar')

  // -------------- check actual communication -----------------------------

  const aliceContacts = await alice.certacrypt.contacts
  t.equals((await aliceSeenFromBob.getProfile())?.username, 'Alice')
  await aliceContacts.addFriend(caesarSeenFromAlice)
  t.equals((await aliceSeenFromBob.getProfile())?.username, 'Alice')
  await aliceContacts.addFriend(bobSeenFromAlice)
  t.equals((await aliceSeenFromBob.getProfile())?.username, 'Alice')

  const bobContacts = await bob.certacrypt.contacts
  await bobContacts.addFriend(aliceSeenFromBob)
  t.equals(await bobContacts.getFriendState(aliceSeenFromBob), FriendState.FRIENDS)

  const contacts = await bobContacts.getAllContacts()
  t.equals(contacts.length, 2)
  t.equals(contacts.map((c) => c.username).join(', '), ['Alice', 'Caesar'].join(', '))

  cleanup()
  t.end()
})

tape('shares', async (t) => {
  const { client, server, cleanup } = await simulator()
  await client.ready()

  // init users
  const alice = await createCertaCrypt(client)
  const bob = await createCertaCrypt(client)

  const aliceUser = await alice.certacrypt.user
  const bobUser = await bob.certacrypt.user

  const aliceProfile = new UserProfile()
  aliceProfile.username = 'Alice'
  await aliceUser.setProfile(aliceProfile)
  t.equals((await aliceUser.getProfile())?.username, 'Alice')

  const bobProfile = new UserProfile()
  bobProfile.username = 'Bob'
  await bobUser.setProfile(bobProfile)
  t.equals((await bobUser.getProfile())?.username, 'Bob')

  const aliceSeenFromBob = await bob.certacrypt.getUserByUrl(aliceUser.getPublicUrl())
  t.equals((await aliceSeenFromBob.getProfile())?.username, 'Alice')
  const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl())
  t.equals((await bobSeenFromAlice.getProfile())?.username, 'Bob')

  // -------------- check actual communication -----------------------------

  const aliceContacts = await alice.certacrypt.contacts
  await aliceContacts.addFriend(bobSeenFromAlice)

  const bobContacts = await bob.certacrypt.contacts
  await bobContacts.addFriend(aliceSeenFromBob)
  t.equals(await bobContacts.getFriendState(aliceSeenFromBob), FriendState.FRIENDS)

  const aliceHome = alice.certacrypt.graph.create<Directory>()
  aliceHome.setContent(new Directory())
  await alice.certacrypt.graph.put(aliceHome)
  const aliceAppRoot = await alice.certacrypt.path('/apps')
  aliceAppRoot.addEdgeTo(aliceHome, 'home')
  await alice.certacrypt.graph.put(aliceAppRoot)

  const share = await alice.certacrypt.createShare(aliceHome)
  await alice.certacrypt.sendShare(share, [bobSeenFromAlice])

  const bobShares = await bobContacts.getAllShares()
  t.equals(bobShares.length, 1)
  t.true(bobShares[0].share.equals(aliceHome))

  cleanup()
  t.end()
})
