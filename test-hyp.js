const { Server, Client } = require('hyperspace')
const readline = require('readline')
const RAM = require('random-access-memory')
start()

async function start () {
  let client
  try {
    client = new Client()
    await client.ready()
  } catch (err) {
    const server = new Server({ storage: RAM })
    await server.ready()
    client = new Client()
    await client.ready()
  }

  const corestore = client.corestore()
  // const core = corestore.get()
  // await new Promise((resolve, reject) => core.ready(err => err ? reject(err) : resolve()))
  // console.log(core.key.toString('hex'))
  // core.append(core.key.toString('hex'))

  /* const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  const remoteKey = await new Promise(resolve => rl.question('insert key\n', ans => {
    rl.close()
    resolve(ans)
  })) */
  const remoteKey = '8ce37a31b41011cd7c044b4b3c0673f414cdcabf8dbd2f8d530bc1172cfbc5aa'
  // await client.network.configure(Buffer.from('f5f173ce1b1077c5f72f8dadc4ca0fa655b5093ecbb8a30626abf95dce3c8704', 'hex'), { lookup: true })

  const remote = corestore.get(remoteKey, { live: true, eagerUpdate: true, announce: true, lookup: true })
  await client.replicate(remote)
  await remote.ready()
  console.log(remote)

  client.network.on('peer-add', peer => {
    console.log(peer)
    remote.get(0, (err, data) => {
      if (err) console.error(err)
      console.log(data.toString('hex'))
    })
  })
}
