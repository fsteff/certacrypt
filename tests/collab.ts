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
import { CollaborationSpace, SpaceQueryState } from '../lib/space'

enableDebugLogging()
const encryptedOpts = { db: { encrypted: true }, encoding: 'utf-8' }

async function createCertaCrypt(client) {
  const store = client.corestore()
  await store.ready()
  const crypto = new DefaultCrypto()
  const certacrypt = new CertaCrypt(store, crypto)
  return { store, crypto, certacrypt }
}

tape('write to collaboration space', async (t) => {
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
  const aliceDriveRoot = alice.certacrypt.graph.create<Directory>()
  await alice.certacrypt.graph.put(aliceDriveRoot)
  appRootAlice.addEdgeTo(aliceDriveRoot, 'drive')
  await alice.certacrypt.graph.put(appRootAlice)
  const aliceDrive = await alice.certacrypt.drive(aliceDriveRoot)
  await aliceDrive.promises.mkdir('/', encryptedOpts)
  await aliceDrive.promises.mkdir('/space', encryptedOpts)
  await aliceDrive.promises.writeFile('/space/readme.txt', 'Hi, I am Alice', encryptedOpts)
  const aliceSpaceRoot = <Vertex<Directory>> await alice.certacrypt.path('/apps/drive/space')
  const aliceSpace = await alice.certacrypt.convertToCollaborationSpace(aliceDriveRoot, aliceSpaceRoot)

  const states = <SpaceQueryState[]> await alice.certacrypt.graph.queryPathAtVertex('/space/readme.txt', aliceDriveRoot).states()
  t.same(states.length, 1)
  t.ok(states[0] instanceof SpaceQueryState)
  t.ok(states[0].space.root.equals(aliceSpaceRoot))
})