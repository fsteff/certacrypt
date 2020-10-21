const ram = require('random-access-memory')
const Corestore = require('corestore')
const hyperdrive = require('hyperdrive')
const wrapHyperdrive = require('../../../modules/core/drive')
const wrapCorestore = require('../../core/corestore')
const CryptoContext = require('../../../modules/crypto/lib/Context')

const context = new CryptoContext()
const corestore = wrapCorestore(new Corestore(ram), context)

wrapHyperdrive(hyperdrive(corestore), context)
  .then(async (drive) => {
    await drive.promises.writeFile('a.txt', 'test')
    await drive.promises.mkdir('test', { encrypted: true })
    await drive.promises.writeFile('test/b.txt', 'test2', { encrypted: true })

    console.log('/:' + JSON.stringify(await drive.promises.readdir('')))
    console.log('/ (hidden):' + await drive.promises.readdir('', { db: { encrypted: true } }))
    console.log('/ (hidden+recursive):' +
    JSON.stringify(
      await drive.promises.readdir('', {
        recursive: true,
        includeStats: true,
        db: { encrypted: true }
      }
      )))
    console.log('a.txt: ' + await drive.promises.readFile('a.txt'))
    console.log('b.txt: ' + await drive.promises.readFile('test/b.txt').catch(() => null))
    const dirstat = await drive.promises.stat('test', { db: { encrypted: true } })
    console.log('/test ctime: ' + dirstat.ctime)
    const stat = await drive.promises.stat('test/b.txt', { db: { encrypted: true } })
    console.log('b.txt ctime: ' + stat.ctime)
    console.log('b.txt (hidden): ' + await drive.promises.readFile('test/b.txt', { db: { encrypted: true } }))
  })
