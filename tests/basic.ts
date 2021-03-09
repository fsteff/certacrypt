import { cryptoDrive } from '../lib/drive'
import { Directory, File } from '../lib/graphObjects'

import RAM from 'random-access-memory'
import Corestore from 'corestore'
import tape from 'tape'
import { CertaCryptGraph } from 'certacrypt-graph'
import { DefaultCrypto } from 'certacrypt-crypto'

tape('write and read', async t => {
    const store = new Corestore(RAM)
    await store.ready()
    const crypto = new DefaultCrypto()
    const db = new CertaCryptGraph(store, null, crypto)
    db.codec.registerImpl(data => new File(data))
    db.codec.registerImpl(data => new Directory(data))

    const v1 = db.create<Directory>()
    await db.put(v1)

    const drive = await cryptoDrive(store, db, crypto, v1)
    await drive.promises.writeFile('test.txt', 'hello world', 'utf-8')

    const content = await drive.promises.readFile('test.txt', 'utf-8')
    t.same(content, 'hello world')
})

