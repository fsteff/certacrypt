import Corestore from 'corestore'
import hyperdrive from 'hyperdrive'
import HyperTrie from 'hypertrie'
import hypertrie from 'hypertrie'
import wrapCorestore from './modules/core/corestore'
import wrapHyperdrive from './modules/core/drive'
import fromUrl from './modules/core/url'
import Graph from './modules/graph'
import CryptoContext from './modules/crypto/lib/Context'
import { generateEncryptionKey } from './modules/crypto/lib/primitives'
import wrapHypercore from './modules/hypercore-encryption-wrapper'


interface DriveOpts {key?: string, rootKey: string, id: string}

export class CertaCrypt{
    private crypto: CryptoContext
    private corestore: Corestore
    private db: HyperTrie
    private readyPromise: Promise<any>


    constructor (masterKey: string, corestore: Corestore | string, crypto?: CryptoContext) {
        this.crypto = crypto || new CryptoContext()
        if (typeof corestore === 'string') {
            this.corestore = wrapCorestore(new Corestore(corestore), this.crypto)
        } else {
            this.corestore = wrapCorestore(corestore, this.crypto)
        }
        
        const dbStore = this.corestore.default()
        const self = this
        this.readyPromise = new Promise((resolve, reject) => {
            dbStore.ready((err) => {
                if (err) reject(err)
                const feedKey = dbStore.key.toString('hex')
                this.crypto.prepareStream(feedKey, 0, masterKey)
                wrapHypercore(dbStore, 
                    this.crypto.getStreamEncryptor(feedKey), 
                    this.crypto.getStreamDecryptor(feedKey)
                )
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
                id: Graph.prefix(),
                createRoot: true
            }

            const drive = hyperdrive(this.corestore, key, graphOpts)
            await wrapHyperdrive(drive, this.crypto, graphOpts)

            await this.putDB('drives/' + drive.key.toString('hex'), graphOpts)           
            return drive
        }
    }

    async getDriveFromURL(url) {
        return await fromUrl(url, this.corestore, this.crypto)
    }

    async getDefaultDrive () {
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
            console.warn('no default hyperdrive found - creating a new one (Error: ' + err.message + ')')
            const drive = hyperdrive(self.corestore)
            await drive.promises.ready()
            const graphOpts =  {
                mainKey: generateEncryptionKey().toString('hex'),
                id: Graph.prefix(),
                createRoot: true,
            }
            const driveOpts = {
                rootKey: graphOpts.mainKey,
                id: graphOpts.id,
                key: drive.key.toString('hex')
            }
            // FIXME: drive.key == self.db.key - but why?
            await wrapHyperdrive(drive, self.crypto, graphOpts)
            await self.putDB('drives/default', driveOpts)
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
}