import simulator from 'hyperspace/simulator'
import tape from 'tape'
import { Cipher, DefaultCrypto } from 'certacrypt-crypto'
import { CertaCrypt } from '..'
import { ReferrerEdge } from '../lib/referrer'
import { SimpleGraphObject, Vertex } from 'hyper-graphdb'

async function createCertaCrypt(client) {
  const store = client.corestore()
  await store.ready()
  const crypto = new DefaultCrypto()
  const certacrypt = new CertaCrypt(store, crypto)
  return { store, crypto, certacrypt }
}

tape('preshared vertex', async (t) => {
  const { client, server, cleanup } = await simulator()
  await client.ready()
  const alice = await createCertaCrypt(client)
  const bob = await createCertaCrypt(client)

  const aliceUser = await alice.certacrypt.user
  const bobUser = await bob.certacrypt.user

  const appRootAlice = await alice.certacrypt.path('/apps')
  const appRootBob = await bob.certacrypt.path('/apps')

  const aliceSpace = alice.certacrypt.graph.create<SimpleGraphObject>()
  aliceSpace.setContent(new SimpleGraphObject().set('hello', 'I am Alice'))
  await alice.certacrypt.graph.put(aliceSpace)
  appRootAlice.addEdgeTo(aliceSpace, 'space')
  await alice.certacrypt.graph.put(appRootAlice)

  const bobSeenFromAlice = await alice.certacrypt.getUserByUrl(bobUser.getPublicUrl())
  await bobSeenFromAlice.referToPresharedVertex(aliceSpace, '.')
  const edge = <ReferrerEdge>aliceSpace.getEdges('.')[0]

  bob.crypto.registerKey(alice.certacrypt.graph.getKey(aliceSpace), { index: aliceSpace.getId(), feed: aliceSpace.getFeed(), type: Cipher.ChaCha20_Stream })
  const bobSpace = <Vertex<SimpleGraphObject>>await bobUser.writeToPresharedVertex(edge)
  bobSpace.setContent(new SimpleGraphObject().set('hello', 'I am Bob'))
  bobSpace.addEdgeTo(aliceSpace, '.')
  appRootBob.addEdgeTo(bobSpace, 'space')
  await bob.certacrypt.graph.put([bobSpace, appRootBob])

  const resultSpaceFromAlice = await alice.certacrypt.graph.queryPathAtVertex('/space/.', appRootAlice).vertices()
  const resultSpaceFromBob = await bob.certacrypt.graph.queryPathAtVertex('/space/.', appRootBob).vertices()

  t.ok(resultSpaceFromAlice.length > 0)
  t.ok(resultSpaceFromBob.length > 0)
  t.ok(resultSpaceFromAlice[0].equals(bobSpace))
  t.ok(resultSpaceFromBob[0].equals(aliceSpace))

  cleanup()
  t.end()
})
