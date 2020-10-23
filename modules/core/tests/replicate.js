const ram = require('random-access-memory')
const tape = require('tape')
const Corestore = require('corestore')
const hyperdrive = require('hyperdrive')
const wrapHyperdrive = require('../../../modules/core/drive')
const wrapCorestore = require('../../core/corestore')
const CryptoContext = require('../../../modules/crypto/lib/Context')
const primitives = require('../../../modules/crypto/lib/primitives')
const { Server, Client } = require('hyperspace')

function replicate (a, b, opts) {
  var stream = a.replicate(true, opts)
  return stream.pipe(b.replicate(false, opts)).pipe(stream)
}

tape('replicate', async t => {
  t.plan(10)
  const context = new CryptoContext()
  const corestore = wrapCorestore(new Corestore(ram), context)
  const key = primitives.generateEncryptionKey().toString('hex')

  const drive = await wrapHyperdrive(hyperdrive(corestore), context, { mainKey: key, createRoot: true })
  await drive.promises.writeFile('a.txt', 'test')
  await drive.promises.mkdir('test', { encrypted: true })
  await drive.promises.writeFile('test/b.txt', 'test2', { encrypted: true })

  t.same(['a.txt'], await drive.promises.readdir(''))
  t.same(['test'], await drive.promises.readdir('', { encrypted: true }))
  t.same(['b.txt', 'test'], await drive.promises.readdir('', { recursive: true, encrypted: true }))
  t.same('test', await drive.promises.readFile('a.txt', { encoding: 'utf-8' }))
  t.same('test2', await drive.promises.readFile('test/b.txt', { encrypted: true, encoding: 'utf-8' }))

  const context2 = new CryptoContext()
  const corestore2 = wrapCorestore(new Corestore(ram), context2)

  const drive2 = hyperdrive(corestore2, drive.key, { sparse: false, sparseMetadata: false })
  replicate(drive, drive2)
  await wrapHyperdrive(drive2, context2, { mainKey: key, createRoot: false })

  t.same(['a.txt'], await drive2.promises.readdir(''))
  t.same(['test'], await drive2.promises.readdir('', { encrypted: true }))
  t.same(['b.txt', 'test'], await drive2.promises.readdir('', { recursive: true, encrypted: true }))
  t.same('test2', await drive2.promises.readFile('test/b.txt', { encrypted: true, encoding: 'utf-8' }))
  t.same('test', await drive2.promises.readFile('a.txt', { encoding: 'utf-8' }))
})

tape('hyperspace', async t => {
  t.plan(10)
  const server = new Server({ storage: ram })
  await server.ready()
  const client = new Client()
  await client.ready()

  const context = new CryptoContext()
  const corestore = wrapCorestore(client.corestore(), context)
  const key = primitives.generateEncryptionKey().toString('hex')

  const drive = await wrapHyperdrive(hyperdrive(corestore), context, { mainKey: key, createRoot: true })
  await drive.promises.writeFile('a.txt', 'test')
  await drive.promises.mkdir('test', { encrypted: true })
  await drive.promises.writeFile('test/b.txt', 'test2', { encrypted: true })

  t.same(['a.txt'], await drive.promises.readdir(''))
  t.same(['test'], await drive.promises.readdir('', { encrypted: true }))
  t.same(['b.txt', 'test'], await drive.promises.readdir('', { recursive: true, encrypted: true }))
  t.same('test', await drive.promises.readFile('a.txt', { encoding: 'utf-8' }))
  t.same('test2', await drive.promises.readFile('test/b.txt', { encrypted: true, encoding: 'utf-8' }))

  const context2 = new CryptoContext()
  const corestore2 = wrapCorestore(client.corestore(), context2)

  const drive2 = hyperdrive(corestore2, drive.key, { sparse: false, sparseMetadata: false })
  await wrapHyperdrive(drive2, context2, { mainKey: key, createRoot: false })

  t.same(['a.txt'], await drive2.promises.readdir(''))
  t.same(['test'], await drive2.promises.readdir('', { encrypted: true }))
  t.same(['b.txt', 'test'], await drive2.promises.readdir('', { recursive: true, encrypted: true }))
  t.same('test2', await drive2.promises.readFile('test/b.txt', { encrypted: true, encoding: 'utf-8' }))
  t.same('test', await drive2.promises.readFile('a.txt', { encoding: 'utf-8' }))

  server.close()
})
