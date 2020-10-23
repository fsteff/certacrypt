const ram = require('random-access-memory')
const tape = require('tape')
const hyperdrive = require('hyperdrive')
const wrapHyperdrive = require('../../../modules/core/drive')
const wrapCorestore = require('../../core/corestore')
const CryptoContext = require('../../../modules/crypto/lib/Context')
const primitives = require('../../../modules/crypto/lib/primitives')
const { Server, Client } = require('hyperspace')

tape('URL', async t => {
  t.plan(2)
  const server = new Server({ storage: ram })
  await server.ready()
  const client = new Client()
  await client.ready()

  const context = new CryptoContext()
  const corestore = wrapCorestore(client.corestore(), context)
  const key = primitives.generateEncryptionKey().toString('hex')

  const drive = await wrapHyperdrive(hyperdrive(corestore), context, key)
  await drive.promises.writeFile('a.txt', 'test')
  await drive.promises.mkdir('test', { encrypted: true })
  await drive.promises.writeFile('test/b.txt', 'test2', { encrypted: true })

  const url = await drive.promises.shareByURL('test', { encrypted: true })

  const context2 = new CryptoContext()
  const corestore2 = wrapCorestore(client.corestore(), context2)

  const drive2 = hyperdrive(corestore2)
  await wrapHyperdrive(drive2, context2)
  await drive2.promises.mountURL(url, 'test')

  t.same(['test'], await drive2.promises.readdir('', { encrypted: true }))
  t.same('test2', await drive2.promises.readFile('test/b.txt', { encrypted: true, encoding: 'utf-8' }))

  server.close()
})
