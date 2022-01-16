import { cryptoDrive } from '../lib/drive'
import { Directory, DriveGraphObject, File, Thombstone } from '../lib/graphObjects'
import simulator from 'hyperspace/simulator'
import RAM from 'random-access-memory'
import Corestore from 'corestore'
import tape from 'tape'
import { CertaCryptGraph } from '@certacrypt/certacrypt-graph'
import { Cipher, DefaultCrypto } from '@certacrypt/certacrypt-crypto'
import { CertaCrypt } from '..'
import { Vertex } from '@certacrypt/hyper-graphdb'

const encryptedOpts = { db: { encrypted: true }, encoding: 'utf-8' }

async function createCertaCrypt(client) {
  await client.ready()
  const store = client.corestore()
  await store.ready()
  const crypto = new DefaultCrypto()
  const certacrypt = new CertaCrypt(store, crypto)
  return { store, crypto, certacrypt }
}

tape('temp drive write and read', async (t) => {
  const { client, server, cleanup } = await simulator()
  const { store, crypto, certacrypt } = await createCertaCrypt(client)

  const root = certacrypt.graph.create<Directory>()
  root.setContent(new Directory())
  await certacrypt.graph.put(root)
  const approot = await certacrypt.path('/apps')
  approot.addEdgeTo(root, 'test')
  await certacrypt.graph.put(approot)

  const drive = await certacrypt.drive(root)
  await drive.promises.writeFile('test.txt', 'test', encryptedOpts)

  let url = certacrypt.getFileUrl(<Vertex<DriveGraphObject>>await certacrypt.path('/apps/test/test.txt'), 'test.txt')
  const file = await certacrypt.getFileByUrl(url)
  const content = await file.readFile(encryptedOpts)

  cleanup()
  t.equals(content, 'test')
})
