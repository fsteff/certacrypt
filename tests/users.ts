import simulator from 'hyperspace/simulator'
import tape from 'tape'
import { Cipher, DefaultCrypto } from 'certacrypt-crypto'
import { CertaCrypt } from '..'
import { ReferrerEdge } from '../lib/referrer'
import { SimpleGraphObject, Vertex } from 'hyper-graphdb'
import { Communication } from '../lib/communication'

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
    await alice.certacrypt.commRoot,
    await alice.certacrypt.cacheDb,
    aliceUser,
    bobSeenFromAlice
  )
  const bobComm = await Communication.InitUserCommunication(
    bob.certacrypt.graph,
    await bob.certacrypt.commRoot,
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

  // TODO: implement and test contacts
  //aliceComm.sendFriendRequest()

  cleanup()
  t.end()
})
