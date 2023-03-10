import { CertaCrypt, GraphObjects, CryptoHyperdrive, Space } from '.'
import RAM from 'random-access-memory'
import Corestore from 'corestore'
import { DefaultCrypto } from '@certacrypt/certacrypt-crypto'
import { average, max, median, min, quantile, standardDeviation } from 'simple-statistics'
import { Vertex } from '@certacrypt/hyper-graphdb'
import { UserProfile } from './lib/graphObjects'
import fs from 'fs/promises'


const encryptedOpts = { db: { encrypted: true }, encoding: 'utf-8' }

const iterations = [
    0, 1, 5, 10, 20, 35, 50, 75, 100,
    0, 1, 5, 10, 20, 35, 50, 75, 100,
    0, 1, 5, 10, 20, 35, 50, 75, 100,
    0, 1, 5, 10, 20, 35, 50, 75, 100,
    0, 1, 5, 10, 20, 35, 50, 75, 100,
    0, 1, 5, 10, 20, 35, 50, 75, 100,
    0, 1, 5, 10, 20, 35, 50, 75, 100,
    0, 1, 5, 10, 20, 35, 50, 75, 100,
    0, 1, 5, 10, 20, 35, 50, 75, 100,
    0, 1, 5, 10, 20, 35, 50, 75, 100
    ]
const rounds = 100


async function createDBs(count: number) {
    const store = new Corestore(RAM)
    await store.ready()
    const instances = new Array<Promise<{certacrypt: CertaCrypt, drive: CryptoHyperdrive, space: Space.CollaborationSpace, driveRoot: Vertex<GraphObjects.Directory>}>>()
    for(let i = 0; i < count; i++) {
        const certacrypt = new CertaCrypt(store, new DefaultCrypto())
        instances.push(drive())

        async function drive() {
            const appRoot = await certacrypt.path('/apps')
            const driveRoot = certacrypt.graph.create<GraphObjects.Directory>()
            driveRoot.setContent(new GraphObjects.Directory())
            await certacrypt.graph.put(driveRoot)
            appRoot.addEdgeTo(driveRoot, 'driveRoot')
            await certacrypt.graph.put(appRoot)

            const profile = new UserProfile()
            profile.username = 'user' + i
            await (await certacrypt.user).setProfile(profile)

            const drive = await certacrypt.drive(driveRoot)
            await drive.promises.mkdir('data', encryptedOpts)
            const space = await certacrypt.convertToCollaborationSpace('/apps/driveRoot/data')

            return {certacrypt, drive, space, driveRoot}
        }
    }
    return await Promise.all(instances)
}


async function benchmarkRestrictions(count: number) {
    // prepare
    const [{certacrypt, drive, space}] = await createDBs(1)
    
    await drive.promises.writeFile('data/readme.txt', 'data :-)', encryptedOpts)
    
    // for debugging purposes uncomment: 
    // await drive.promises.writeFile('data/readmenot.txt', 'data :-(', encryptedOpts)
    // console.log(await certacrypt.debugDrawGraph(await certacrypt.path('/apps')))

    
    const dataEdge = space.root.getEdges()[0]
    if(!Array.isArray(dataEdge.restrictions)) dataEdge.restrictions = []
    for(let i = 0; i < count; i++) {
        const restriction = { rule: '!**/*.txt',  except: {rule: '*/data/readme.txt'}}
        dataEdge.restrictions.push(restriction)
    }
    space.root.setEdges([dataEdge])
    await certacrypt.graph.put(space.root)

    const start = process.hrtime()
    // start benchmark
    for(let i = 0; i < rounds; i++) {
        const result = await drive.promises.readdir('data', encryptedOpts)
        if(result.length !== 1 || result[0] !== 'readme.txt') throw new Error('dir contents are wrong: ' + result)
    }

    // end benchmark
    const [seconds, nano] = process.hrtime(start)
    return seconds + nano / 1e9
}

async function benchmarkWriters(count: number) {
    console.log('prepare benchmark')
    const dbs = await createDBs(count+1)
    const main = dbs[0]
    const writers = dbs.slice(1)

    await main.drive.promises.writeFile('/data/readme.txt', 'first!', encryptedOpts)
    const mainUser = await main.certacrypt.user
    const mainContacts = await main.certacrypt.contacts

    for (let index = 0; index < writers.length; index++) {
        const writer = writers[index]
        const user = await writer.certacrypt.user
        const userSeenByMain = await main.certacrypt.getUserByUrl(user.getPublicUrl())
        const mainSeenByUser = await writer.certacrypt.getUserByUrl(mainUser.getPublicUrl())
        const contacts = await writer.certacrypt.contacts
        await mainContacts.addFriend(userSeenByMain)
        await contacts.addFriend(mainSeenByUser)

        // share space with user and give write permissions
        await main.space.addWriter(userSeenByMain)
        const share = await main.certacrypt.createShare(main.space.root, true)
        await main.certacrypt.sendShare(share, [userSeenByMain])

        // mount received shares to directory 'shares'
        const shares = await writer.certacrypt.driveShares
        await writer.drive.promises.mkdir('shares', encryptedOpts)
        await shares.mountAt(writer.drive, writer.driveRoot, 'shares')

        // get name of auto-mounted share
        const dirs = await writer.drive.promises.readdir('shares', encryptedOpts)
        if(dirs.length !== 1) throw new Error('Expected one shared directory, got: ' + dirs)

        // write one file
        const path = 'shares/' + dirs[0] + '/readme.txt'
        const text = 'writer ' + index
        await writer.drive.promises.writeFile(path, text, encryptedOpts)
    }

    console.log('start benchmark')
    const start = process.hrtime()
    // start benchmark
    for(let i = 0; i < rounds; i++) {
        const dirs = await main.drive.promises.readdir('data', encryptedOpts)
        if(dirs.length !== 1) throw new Error('wrong file count')
    }
    // end benchmark
    const [seconds, nano] = process.hrtime(start)
    console.log('finished benchmark in ' + (seconds + nano / 1e9) + 's')
    return seconds + nano / 1e9
}

async function benchmarkOutbox(count: number) {
    const [aliceDB, bobDB] = await createDBs(2)
    
    const alice = await aliceDB.certacrypt.user
    const bob = await bobDB.certacrypt.user
    const bobSeenByAlice = await aliceDB.certacrypt.getUserByUrl(bob.getPublicUrl())
    const aliceSeenByBob = await bobDB.certacrypt.getUserByUrl(alice.getPublicUrl())
    
    const inbox = await alice.getInbox()
    for(let i = 0; i < count; i++) {
        await inbox.postEnvelope(alice.publicRoot, bobSeenByAlice)
    }
    const aliceInbox = await aliceSeenByBob.getInbox()

    console.log('start benchmark')
    const start = process.hrtime()
    
    // start benchmark
    for(let i = 0; i < rounds; i++) {
       const messages = await aliceInbox.checkEnvelopes()
       if(messages.length !== count) throw new Error('Expected ' + count + ' messages, found ' + messages?.length) 
    }
    // end benchmark
    const [seconds, nano] = process.hrtime(start)
    console.log('finished benchmark in ' + (seconds + nano / 1e9) + 's')
    return seconds + nano / 1e9
}
           
async function run(benchmark: (count: number) => Promise<number>) {
    const name = benchmark.name
    console.log('warmup for benchmark ' + name + '...')
    await benchmark(10)

    const results = new Map<number, number[]>()

    for(let i = 0; i < iterations.length; i++) {
        const count = iterations[i]
        console.log("start " + count + ' (' + i + "/" + iterations.length + ") " + name)
        const milliseconds = (await benchmark(count)) / rounds * 1000 
        const prev = results.get(count) || []
        prev.push(milliseconds)
        results.set(count, prev)

        console.log("took " + count + " " + name + " in " + milliseconds + 'ms per execution')
    }

    let rawData = ''
    let stats = 'N; avg.; median; std. dev.; 1st q; 3rd q; min; max\n'

    for(const count of results.keys()) {
        const row = results.get(count)
        rawData +=  count + '; ' + row.map(v => excelNumber(v, 6)).join('; ') + '\n'
        stats +=  count + '; ' + excelNumber(average(row)) + '; ' + excelNumber(median(row)) + '; ' + excelNumber(standardDeviation(row))
        + '; ' +  excelNumber(quantile(row, 0.25)) + '; ' +  excelNumber(quantile(row, 0.75)) 
        + '; ' +  excelNumber(min(row))  + '; ' +  excelNumber(max(row)) + '\n'
    }

    console.log(name + ' result stats: \n' + stats)
    console.log('raw data: \n' + rawData)

    await mkdir('benchmark_results')
    await fs.appendFile('benchmark_results/' + name + '_stats.csv', stats)
    await fs.appendFile('benchmark_results/' + name + '_raw.csv', rawData)
    
}

function excelNumber(n: number, exp = 3) {
    // MS excel does not recognize numbers with points as number...
    return n.toFixed(exp).replace('.', ',')
}

async function mkdir(path: string) {
    try {
        await fs.access(path)
    } catch {
        await fs.mkdir(path)
    }
}


run(benchmarkRestrictions)
.then(() => run(benchmarkWriters))
.then(() => run(benchmarkOutbox))
run(benchmarkOutbox)
.catch(console.error)