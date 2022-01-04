import simulator from 'hyperspace/simulator'
import tape from 'tape'
import { DefaultCrypto } from 'certacrypt-crypto'
import { CertaCrypt } from '..'
import { Directory } from '../lib/graphObjects'
import { enableDebugLogging } from '../lib/debug'
import { SpaceQueryState } from '../lib/space'
import { ShareGraphObject, SHARE_VIEW } from 'certacrypt-graph'
import { Vertex } from 'hyper-graphdb'
import { readdirResult, spaceMetaData, Stat } from '../lib/types'

enableDebugLogging()

const encryptedOpts = { db: { encrypted: true }, encoding: 'utf-8' }

async function createCertaCrypt(client) {
  const store = client.corestore()
  await store.ready()
  const crypto = new DefaultCrypto()
  const certacrypt = new CertaCrypt(store, crypto)
  return { store, crypto, certacrypt }
}

tape('key rotation', async (t) => {
  const { client, server, cleanup } = await simulator()
  await client.ready()
  t.teardown(cleanup)

  // init users
  const alice = await createCertaCrypt(client)
  const bob = await createCertaCrypt(client)

  const aliceUser = await alice.certacrypt.user
  const bobUser = await bob.certacrypt.user
  const aliceSeenFromBob = await bob.certacrypt.getUserByUrl(aliceUser.getPublicUrl())
  const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl())
  await (await alice.certacrypt.contacts).addFriend(bobSeenFromAlice)
  await (await bob.certacrypt.contacts).addFriend(aliceSeenFromBob)

  // preparing alice
  const appRootAlice = await alice.certacrypt.path('/apps')
  let aliceDriveRoot = alice.certacrypt.graph.create<Directory>()
  await alice.certacrypt.graph.put(aliceDriveRoot)
  appRootAlice.addEdgeTo(aliceDriveRoot, 'drive')
  await alice.certacrypt.graph.put(appRootAlice)
  const aliceDrive = await alice.certacrypt.drive(aliceDriveRoot)
  await aliceDrive.promises.mkdir('/', encryptedOpts)
  await aliceDrive.promises.mkdir('/shares', encryptedOpts)
  await (await alice.certacrypt.driveShares).mountAt(aliceDrive, await alice.certacrypt.path('/apps/drive'), 'shares')

  await aliceDrive.promises.mkdir('/space', encryptedOpts)
  const spaceVertexKey = alice.certacrypt.graph.getKey(await alice.certacrypt.path('/apps/drive/space'))
  t.ok(Buffer.isBuffer(spaceVertexKey))

  await aliceDrive.promises.writeFile('/space/readme.txt', 'Hi, I am Alice', encryptedOpts)
  const spaceVertexKey2 = alice.certacrypt.graph.getKey(await alice.certacrypt.path('/apps/drive/space'))
  t.ok(Buffer.isBuffer(spaceVertexKey2))
  t.ok(!spaceVertexKey.equals(spaceVertexKey2))
})
