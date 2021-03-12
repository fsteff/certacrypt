import { cryptoDrive } from '../lib/drive'
import { Directory, File } from '../lib/graphObjects'

import RAM from 'random-access-memory'
import Corestore from 'corestore'
import tape from 'tape'
import { CertaCryptGraph } from 'certacrypt-graph'
import { Cipher, DefaultCrypto } from 'certacrypt-crypto'
import { readdirResult } from '../lib/types'

const encryptedOpts = {db: {encrypted: true}, encoding: 'utf-8'}

async function createDB() {
    const store = new Corestore(RAM)
    await store.ready()
    const crypto = new DefaultCrypto()
    const db = new CertaCryptGraph(store, null, crypto)
    db.codec.registerImpl(data => new File(data))
    db.codec.registerImpl(data => new Directory(data))
    return {store, crypto, db}
}

tape('write and read', async t => {
    const {store, crypto, db} = await createDB()

    const v1 = db.create<Directory>()
    await db.put(v1)

    const drive = await cryptoDrive(store, db, crypto, v1)
    await drive.promises.writeFile('test.txt', 'hello world', encryptedOpts)

    let content = await drive.promises.readFile('test.txt', encryptedOpts)
    t.same(content, 'hello world')

    await drive.promises.writeFile('/subdir/test.txt', 'hello there', encryptedOpts)

    content = await drive.promises.readFile('/subdir/test.txt', encryptedOpts)
    t.same(content, 'hello there')
})

tape('public', async t => {
    const {store, crypto, db} = await createDB()

    const v1 = db.create<Directory>()
    await db.put(v1)

    const drive = await cryptoDrive(store, db, crypto, v1)
    await drive.promises.writeFile('test.txt', 'hello world', 'utf-8')

    const content = await drive.promises.readFile('test.txt', 'utf-8')
    t.same(content, 'hello world')
})

tape('2 DBs', async t => {
    const store = new Corestore(RAM)
    await store.ready()
    const crypto = new DefaultCrypto()
    const crypto2 = new DefaultCrypto()
    const db = new CertaCryptGraph(store.namespace('1'), null, crypto)
    const db2 = new CertaCryptGraph(store.namespace('2'), null, crypto2)
    db.codec.registerImpl(data => new File(data))
    db.codec.registerImpl(data => new Directory(data))
    db2.codec.registerImpl(data => new File(data))
    db2.codec.registerImpl(data => new Directory(data))

    const v1 = db.create<Directory>()
    await db.put(v1)

    const v2 = db2.create<Directory>()
    v2.addEdgeTo(v1, 'mount')
    crypto2.registerKey(db.getKey(v1), {feed: v1.getFeed(), index: v1.getId(), type: Cipher.ChaCha20_Stream})
    await db2.put(v2)

    const drive = await cryptoDrive(store.namespace('d1'), db, crypto, v1)
    await drive.promises.writeFile('test.txt', 'hello world', encryptedOpts)
    
    const drive2 = await cryptoDrive(store.namespace('d2'), db2, crypto2, v2)
    const content = await drive2.promises.readFile('/mount/test.txt', encryptedOpts)
    t.same(content, 'hello world')
})

tape('readdir', async t => {
    const {store, crypto, db} = await createDB()

    const v1 = db.create<Directory>()
    await db.put(v1)

    const drive = await cryptoDrive(store, db, crypto, v1)
    await drive.promises.writeFile('docs/test.txt', 'hello world', encryptedOpts)

    const content = await drive.promises.readFile('docs/test.txt', encryptedOpts)
    t.same(content, 'hello world')

    const results = await drive.promises.readdir('docs', {...encryptedOpts, includeStats: true})
    t.same(results.length, 1)
    const first = <{name: string, path: string}> results[0]
    t.same(first.name, 'text.txt')
    t.same(first.path, '/docs/test.txt')
})