import simulator from 'hyperspace/simulator'
import tape from 'tape'
import { DefaultCrypto } from 'certacrypt-crypto'
import { CertaCrypt, createUrl, URL_TYPES } from '..'
import { Directory } from '../lib/graphObjects'
import { enableDebugLogging } from '../lib/debug'
import { SpaceQueryState } from '../lib/space'
import { VertexLoadingError } from 'hyper-graphdb/lib/Errors'

//enableDebugLogging()

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

  //preparing bob
  const appRootBob = await bob.certacrypt.path('/apps')
  let bobDriveRoot = bob.certacrypt.graph.create<Directory>()
  await bob.certacrypt.graph.put(bobDriveRoot)
  appRootBob.addEdgeTo(bobDriveRoot, 'drive')
  await bob.certacrypt.graph.put(appRootBob)
  const bobDrive = await bob.certacrypt.drive(bobDriveRoot)
  await bobDrive.promises.mkdir('/', encryptedOpts)
  await bobDrive.promises.mkdir('/shares', encryptedOpts)
  await (await bob.certacrypt.driveShares).mountAt(bobDrive, await bob.certacrypt.path('/apps/drive'), 'shares')

  // test alice's key rotation
  await aliceDrive.promises.mkdir('/space', encryptedOpts)
  const spaceVertexKey = alice.certacrypt.graph.getKey(await alice.certacrypt.path('/apps/drive/space'))
  t.ok(Buffer.isBuffer(spaceVertexKey))

  await aliceDrive.promises.writeFile('/space/readme.txt', 'Hi, I am Alice', encryptedOpts)
  const spaceVertexKey2 = alice.certacrypt.graph.getKey(await alice.certacrypt.path('/apps/drive/space'))
  t.ok(Buffer.isBuffer(spaceVertexKey2))
  t.ok(!spaceVertexKey.equals(spaceVertexKey2))

  // create shares & mount at bob
  const spaceVertex = await alice.certacrypt.path('/apps/drive/space')
  const share1 = await alice.certacrypt.createShare(spaceVertex, true)
  const share2 = await alice.certacrypt.createShare(spaceVertex, true)
  const share3 = await alice.certacrypt.createShare(spaceVertex, false)

  t.ok(share1.equals(share2))
  t.ok(!share1.equals(share3))

  const share2Url = createUrl(share2, alice.certacrypt.graph.getKey(share2), undefined, URL_TYPES.SHARE, 'space')
  const share3Url = createUrl(share3, alice.certacrypt.graph.getKey(share3), undefined, URL_TYPES.SHARE, 'space')

  await bob.certacrypt.mountShare(await bob.certacrypt.path('/apps/drive'), 'space', share2Url)
  let dirFiles = await bobDrive.promises.readdir('/space', encryptedOpts)
  t.same(dirFiles, ['readme.txt'])
  let fileContent = await bobDrive.promises.readFile('/space/readme.txt', encryptedOpts)
  t.same(fileContent, 'Hi, I am Alice')

  await alice.certacrypt.sendShare(share3Url, [bobSeenFromAlice])
  const bobShares = await (await bob.certacrypt.contacts).getAllReceivedShares()
  t.ok(bobShares.length === 1)
  t.ok(bobShares[0].share.equals(share3))
  t.ok(bobShares[0].target.equals(spaceVertex))

  t.same(share2.getContent()?.revoked, undefined)
  // revoke file
  await (await alice.certacrypt.driveShares).revokeShare(share2)
  await aliceDrive.promises.writeFile('/space/readme.txt', 'Hi, I am Alice 2', encryptedOpts)

  try {
    await bob.certacrypt.path('/apps/drive/space')
    t.fail('supposed to fail')
  } catch (err) {
    t.same((<VertexLoadingError>err).cause?.message, 'Share has been revoked')
  }
  dirFiles = await bobDrive.promises.readdir('/space', encryptedOpts)
  t.same(dirFiles, [])

  const spaceVertexKey3 = alice.certacrypt.graph.getKey(await alice.certacrypt.path('/apps/drive/space'))
  t.ok(Buffer.isBuffer(spaceVertexKey3))
  t.ok(!spaceVertexKey2.equals(spaceVertexKey3))
})

tape('space key rotation', async (t) => {
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
  await aliceDrive.promises.mkdir('/space', encryptedOpts)
  await (await alice.certacrypt.driveShares).mountAt(aliceDrive, await alice.certacrypt.path('/apps/drive'), 'shares')
  const spaceAlice = await alice.certacrypt.convertToCollaborationSpace('/apps/drive/space')
  const spaceShareAlice = await alice.certacrypt.createShare(spaceAlice.root)
  const spaceShareUrl = await alice.certacrypt.createShare(spaceAlice.root, true)
  await alice.certacrypt.sendShare(spaceShareAlice, [bobSeenFromAlice])
  await spaceAlice.addWriter(bobSeenFromAlice)

  //preparing bob
  const appRootBob = await bob.certacrypt.path('/apps')
  let bobDriveRoot = bob.certacrypt.graph.create<Directory>()
  await bob.certacrypt.graph.put(bobDriveRoot)
  appRootBob.addEdgeTo(bobDriveRoot, 'drive')
  await bob.certacrypt.graph.put(appRootBob)
  const bobDrive = await bob.certacrypt.drive(bobDriveRoot)
  await bobDrive.promises.mkdir('/', encryptedOpts)
  await bobDrive.promises.mkdir('/shares', encryptedOpts)
  await (await bob.certacrypt.driveShares).mountAt(bobDrive, await bob.certacrypt.path('/apps/drive'), 'shares')
  const sharePathBob = await bobDrive.promises.readdir('/shares', encryptedOpts)
  await bobDrive.promises.writeFile('/shares/' + sharePathBob + '/test.txt', 'Hey I am Bob', encryptedOpts)

  // test setup
  let fileContent = await aliceDrive.promises.readFile('/space/test.txt', encryptedOpts)
  t.same(fileContent, 'Hey I am Bob')
  const spaceStates = await bob.certacrypt.graph
    .queryPathAtVertex('/apps/drive/shares/' + sharePathBob + '/test.txt', await bob.certacrypt.sessionRoot)
    .states()
  const spaceSeenFromBob = (<SpaceQueryState>spaceStates[0]).space
  const refKey1 = bob.certacrypt.graph.getKey(await spaceSeenFromBob.tryGetWriteableRoot())
  t.ok(refKey1)

  await (await alice.certacrypt.driveShares).revokeShare(spaceShareUrl)
  await aliceDrive.promises.writeFile('/space/test2.txt', 'Hey I am Alice', encryptedOpts)
  await bobDrive.promises.writeFile('/shares/' + sharePathBob + '/test.txt', 'Hello', encryptedOpts)

  fileContent = await aliceDrive.promises.readFile('/space/test.txt', encryptedOpts)
  t.same(fileContent, 'Hello')

  const spaceStates2 = await bob.certacrypt.graph
    .queryPathAtVertex('/apps/drive/shares/' + sharePathBob + '/test.txt', await bob.certacrypt.sessionRoot)
    .states()
  const spaceSeenFromBob2 = (<SpaceQueryState>spaceStates2[0]).space
  const refKey2 = bob.certacrypt.graph.getKey(await spaceSeenFromBob2.tryGetWriteableRoot())
  t.ok(refKey2)
  t.ok(!refKey1.equals(refKey2))
})
