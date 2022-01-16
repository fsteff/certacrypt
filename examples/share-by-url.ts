import { DefaultCrypto } from '@certacrypt/certacrypt-crypto'
import { Corestore, Vertex } from '@certacrypt/hyper-graphdb'
import { Client, Server } from 'hyperspace'
import simulator from 'hyperspace/simulator'
import { CertaCrypt } from '..'
import fs from 'fs/promises'
import { Directory } from '../lib/graphObjects'
import unixify from 'unixify'
import { createUrl } from '../lib/url'

let server
let close: () => void

startHyperspace()
  .then(startCertaCrypt)
  .then(runApp)
  .then(() => close())
  .catch((err) => console.error(err))

async function runApp(app: CertaCrypt) {
  switch (process.argv[2]) {
    case 'start':
      await start(app)
      break
    case 'open':
      await open(app)
      break
  }
}

async function open(app: CertaCrypt) {
  let url = process.argv[3]
  if (!url) throw new Error('no URL specified')
  let target = process.argv[4]
  if (!target) throw new Error('no target file specified')

  await app.mountShare(await app.path('/apps'), 'shared', url)
  const dir = <Vertex<Directory>>await app.path('/apps/shared')
  const drive = await app.drive(dir)
  const files = await drive.promises.readdir('/', { db: { encrypted: true } })
  console.log('found files: ' + files)
  const content = await drive.promises.readFile('/' + files[0])
  await fs.writeFile(target, content)
}

async function start(app: CertaCrypt) {
  if (!process.argv[3]) throw new Error('argument 3 not specified')
  let file = unixify(process.argv[3])
  const content = await fs.readFile(file, 'utf-8')
  const path = file.split('/')
  const filename = path[path.length - 1]

  const appRoot = await app.path('/apps')
  let driveRoot: Vertex<Directory>
  if (appRoot.getEdges('drive').length === 0) {
    driveRoot = app.graph.create<Directory>()
    await app.graph.put(driveRoot)
    appRoot.addEdgeTo(driveRoot, 'drive')
    await app.graph.put(appRoot)
  } else {
    driveRoot = <Vertex<Directory>>await app.path('/apps/drive')
  }
  const drive = await app.drive(driveRoot)
  await drive.promises.writeFile(filename, content)
  console.log('file successfully written')

  const share = await app.createShare(driveRoot)
  const url = createUrl(share, app.graph.getKey(share))
  console.log('drive can be shared using the url ' + url)

  console.log('press any key to end program...')
  process.stdin.once('data', () => process.exit())
}

async function startHyperspace() {
  if (process.argv[1] === 'open') {
    const { client, cleanup } = await simulator()
    close = cleanup
    return client
  }

  let corestore
  try {
    let client = new Client()
    await client.ready()
    corestore = client.corestore()
  } catch (e) {
    server = new Server()
    await server.ready()
    close = () => server.stop()
    let client = new Client()
    await client.ready()
    corestore = client.corestore()
  }
  return corestore.namespace('certacrypt example')
}

async function startCertaCrypt(corestore: Corestore) {
  let session
  switch (process.argv[2]) {
    case 'start':
      session = process.argv[4]
      break
    case 'open':
      break
    default:
      console.error('no command specified')
      console.log(process.argv)
      process.exit()
  }

  return new CertaCrypt(corestore, new DefaultCrypto(), session)
}
