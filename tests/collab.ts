import simulator from 'hyperspace/simulator'
import tape from 'tape'
import { DefaultCrypto } from 'certacrypt-crypto'
import { CertaCrypt } from '..'
import { Directory } from '../lib/graphObjects'
import { enableDebugLogging } from '../lib/debug'
import { SpaceQueryState } from '../lib/space'
import { ShareGraphObject, SHARE_VIEW } from 'certacrypt-graph'
import { Vertex } from 'hyper-graphdb'

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
  await aliceDrive.promises.mkdir('/space', encryptedOpts)
  await aliceDrive.promises.writeFile('/space/readme.txt', 'Hi, I am Alice', encryptedOpts)
  // convert to space

  // FIXME: in memory this aliceDrive root is the directory, not the space!!!!
  aliceDriveRoot = await aliceDrive.updateRoot()
  const aliceSpaceRoot = <Vertex<Directory>>await alice.certacrypt.path('/apps/drive/space')
  const aliceSpace = await alice.certacrypt.convertToCollaborationSpace(aliceDriveRoot, aliceSpaceRoot)
  aliceDriveRoot = await aliceDrive.updateRoot()

  // preparing bob
  const appRootBob = await bob.certacrypt.path('/apps')
  const bobDriveRoot = bob.certacrypt.graph.create<Directory>()
  await bob.certacrypt.graph.put(bobDriveRoot)
  appRootBob.addEdgeTo(bobDriveRoot, 'drive')
  await bob.certacrypt.graph.put(appRootBob)
  const bobDrive = await bob.certacrypt.drive(bobDriveRoot)
  await bobDrive.promises.mkdir('/', encryptedOpts)

  // test if the converted directory queries work
  let states = <SpaceQueryState[]>await alice.certacrypt.graph.queryPathAtVertex('/space/readme.txt', aliceDriveRoot).states()
  t.same(states.length, 1)
  t.ok(states[0] instanceof SpaceQueryState)
  t.ok(states[0].space.root.equals(aliceSpace.root))

  // test write & read of owned space
  await aliceDrive.promises.writeFile('/space/readme2.txt', 'Hi, I am Alice, #2', encryptedOpts)
  let readme = await aliceDrive.promises.readFile('/space/readme2.txt', encryptedOpts)
  t.same(readme, 'Hi, I am Alice, #2')
  let files = await aliceDrive.promises.readdir('/space', encryptedOpts)
  t.same(files, ['readme.txt', 'readme2.txt'])

  // share with bob
  const sharedSpace = await alice.certacrypt.createShare(aliceSpace.root)
  await alice.certacrypt.sendShare(sharedSpace, [bobSeenFromAlice])
  await aliceSpace.addWriter(bobSeenFromAlice)
  const bobShares = await (await bob.certacrypt.contacts).getAllReceivedShares()
  t.same(bobShares.length, 1)
  const bobShare = <Vertex<ShareGraphObject>>bobShares[0].share
  bobDriveRoot.addEdgeTo(bobShare, 'alice', { view: SHARE_VIEW })
  await bob.certacrypt.graph.put(bobDriveRoot)
  readme = await bobDrive.promises.readFile('/alice/readme.txt', encryptedOpts)
  t.same(readme, 'Hi, I am Alice')

  // test write access
  await bobDrive.promises.mkdir('/alice/bobs/', encryptedOpts)

  files = await bobDrive.promises.readdir('/alice', encryptedOpts)
  t.same(files, ['readme.txt', 'readme2.txt', 'bobs'])
  files = await aliceDrive.promises.readdir('/space', encryptedOpts)
  t.same(files, ['readme.txt', 'readme2.txt', 'bobs'])

  await bobDrive.promises.writeFile('/alice/bobs/hello.txt', 'Hello, I am Bob', encryptedOpts)
  let helloFile = await bobDrive.promises.readFile('/alice/bobs/hello.txt', encryptedOpts)
  t.same(helloFile, 'Hello, I am Bob')
  helloFile = await aliceDrive.promises.readFile('/space/bobs/hello.txt', encryptedOpts)
  t.same(helloFile, 'Hello, I am Bob')

  // test conflicts
  await bobDrive.promises.writeFile('/alice/readme.txt', 'Hehe, I overwrote it', encryptedOpts)
  states = <SpaceQueryState[]>await bob.certacrypt.graph.queryPathAtVertex('/alice/readme.txt', await bobDrive.updateRoot()).states()
  t.same(states.length, 2)
  readme = await bobDrive.promises.readFile('/alice/readme.txt', encryptedOpts)
  t.same(readme, 'Hehe, I overwrote it')
})
