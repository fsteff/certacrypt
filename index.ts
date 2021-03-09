import Corestore from 'corestore'
import hyperdrive from 'hyperdrive'
import HyperTrie from 'hypertrie'
import hypertrie from 'hypertrie'
import wrapCorestore from './modules/core/corestore'
import wrapHyperdrive from './modules/core/drive'
import fromUrl from './modules/core/url'
import Graph from './modules/graph'
import CryptoContext from './modules/crypto/lib/Context'
import { generateEncryptionKey, hash } from './modules/crypto/lib/primitives'
import wrapHypercore from './modules/hypercore-encryption-wrapper'


interface DriveOpts {key?: string, rootKey: string, id: string}

export class CertaCrypt{
    private crypto: CryptoContext
    private corestore: Corestore
    private db: HyperTrie
    private readyPromise: Promise<any>


    constructor (masterKey: string, corestore: Corestore | string, crypto?: CryptoContext) {
        const namespace = hash(masterKey).toString('hex')
        this.crypto = crypto || new CryptoContext()
        if (typeof corestore === 'string') {
            this.corestore = wrapCorestore(new Corestore(corestore).namespace(namespace), this.crypto)
        } else {
            this.corestore = wrapCorestore(corestore.namespace(namespace), this.crypto)
        }
        
        const dbStore = this.corestore.default()
        const self = this
        this.readyPromise = new Promise((resolve, reject) => {
            dbStore.ready((err) => {
                if (err) reject(err)
                const feedKey = dbStore.key.toString('hex')
                console.info('db feed key is ' + feedKey)
                self.crypto.prepareStream(feedKey, 0, masterKey)
                self.db = hypertrie(null, null, { feed: dbStore, valueEncoding: 'json' })
                resolve()
            })
        })
    }

    async ready() {
        return this.readyPromise
    }

    async getDrive (key?: string | Buffer, opts?: any) {
        if (key) {
            const driveOpts = await this.getDB('drives/' + key).then((node: {value: DriveOpts}) => node ? node.value : null)
            if (!driveOpts) throw new Error('no drive with key ' + key + ' found')
            const drive = hyperdrive(this.corestore, key)
            await drive.promises.ready()
            await wrapHyperdrive(drive, self.crypto, { mainKey: driveOpts.rootKey, id: opts.id, createRoot: false })
            return drive
        } else {
            const graphOpts =  {
                mainKey: generateEncryptionKey().toString('hex'),
                id: Graph.prefix() + '1',
                createRoot: true
            }

            const drive = await this.createNewHyperdrive()
            await wrapHyperdrive(drive, this.crypto, graphOpts)

            await this.putDB('drives/' + drive.key.toString('hex'), graphOpts)           
            return drive
        }
    }

    async getDriveFromURL(url) : hyperdrive {
        return await fromUrl(url, this.corestore, this.crypto)
    }

    async getDefaultDrive (): typeof hyperdrive {
        const self = this
        await this.ready()
        return this.getDB('drives/default')
            .then((node: {value: any}) => {
                if (node) return node.value
                else throw new Error('no default found')
            })
            .then(getDrive)
            .catch(createDefault)

        async function getDrive(opts: DriveOpts) {
            const drive = hyperdrive(self.corestore, opts.key)
            await drive.promises.ready()
            await wrapHyperdrive(drive, self.crypto, { mainKey: opts.rootKey, id: opts.id, createRoot: false })
            return drive
        }

        async function createDefault (err: Error) {
            console.warn(`no default hyperdrive found - creating a new one (Error: "${err.message}" at ${err.stack ? '\n' + err.stack + '\n' : 'no stacktrace available'})`)
            const drive = await self.createNewHyperdrive()
            const graphOpts =  {
                mainKey: generateEncryptionKey().toString('hex'),
                id: Graph.prefix() + '1',
                createRoot: true,
            }
            const driveOpts = {
                rootKey: graphOpts.mainKey,
                id: graphOpts.id,
                key: drive.key.toString('hex')
            }

            await wrapHyperdrive(drive, self.crypto, graphOpts)
            console.info('default drive key is ' + drive.key.toString('hex'))
            await self.putDB('drives/default', driveOpts)
            return drive
        }
    }

    async putDB (key: string, value: any, opts?: any) {
        const self = this
        await this.ready()
        return new Promise((resolve, reject) => {
            self.db.put(key, value, opts, (err, ...res) => err ? reject(err) : resolve(...res))
        })
    }

    async getDB (key: string, opts?: any) {
        const self = this
        await this.ready()
        return new Promise((resolve, reject) => {
            self.db.get(key, opts, (err, ...res) => err ? reject(err) : resolve(...res))
        })
    }

    static generateMasterKey() {
        return generateEncryptionKey().toString('hex')
    }

    private async createNewHyperdrive() {
        // make sure to pass enough new entropy to the corestore
        const sub = this.corestore.namespace(generateEncryptionKey().toString('hex'))
        wrapCorestore(sub, this.crypto)
        const drive = hyperdrive(sub)
        await drive.promises.ready()
        return drive
    }
}