const ram = require('random-access-memory')
const tape = require('tape')
const Corestore = require('corestore')
const hyperdrive = require('hyperdrive')
const wrapHyperdrive = require('../../../modules/core/drive')
const wrapCorestore = require('../../core/corestore')
const CryptoContext = require('../../../modules/crypto/lib/Context')

tape('basic', t => {
  t.plan(6)
  const context = new CryptoContext()
  const corestore = wrapCorestore(new Corestore(ram), context)

  wrapHyperdrive(hyperdrive(corestore), context)
    .then(async (drive) => {
      await drive.promises.writeFile('a.txt', 'test')
      await drive.promises.mkdir('test', { encrypted: true })
      await drive.promises.writeFile('test/b.txt', 'test2', { encrypted: true })

      t.same(['a.txt'], await drive.promises.readdir(''))
      t.same(['test'], await drive.promises.readdir('', { encrypted: true }))
      t.same(['b.txt', 'test'], await drive.promises.readdir('', { recursive: true, encrypted: true }))
      t.same('test', await drive.promises.readFile('a.txt', { encoding: 'utf-8' }))
      t.same('file not found', await drive.promises.readFile('test/b.txt').catch(() => 'file not found'))
      t.same('test2', await drive.promises.readFile('test/b.txt', { encrypted: true, encoding: 'utf-8' }))
    })
})
