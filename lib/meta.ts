import { Hyperdrive, Stat } from './types'
import { CertaCryptGraph } from 'certacrypt-graph'
import { Vertex } from 'hyper-graphdb'
import { DriveGraphObject, File, GraphObjectTypeNames } from './graphObjects'
import { FileNotFound, PathAlreadyExists } from 'hyperdrive/lib/errors'
import unixify from 'unixify'
import { cryptoTrie } from './crypto'
import { Cipher, ICrypto } from 'certacrypt-crypto'
import MountableHypertrie from 'mountable-hypertrie'
import { Feed } from 'hyperobjects'
import drive from '../modules/core/drive'
import { Directory } from '../modules/graph/schema'



export class MetaStorage {
    private readonly drive: Hyperdrive
    private readonly graph: CertaCryptGraph
    private readonly root: Vertex<DriveGraphObject>
    private readonly tries: Map<string, MountableHypertrie>
    private readonly crypto: ICrypto
    private idCtr = 0

    constructor(drive: Hyperdrive, graph: CertaCryptGraph, root: Vertex<DriveGraphObject>, crypto: ICrypto) {
        this.drive = drive
        this.graph = graph
        this.root = root
        this.crypto = crypto
        this.tries = new Map<string, MountableHypertrie>()
    }

    async readableFile(filename: string, encrypted = true) {
        const vertex = latestWrite(await this.graph.queryPathAtVertex(filename, this.root).generator().destruct())
        if (!vertex) throw new FileNotFound(filename)

        const file = vertex.getContent()
        if (!file.filename) throw new Error('vertex is not of type file or directory, it does not have a filename url')
        const { feed, path, mkey, fkey } = this.parseUrl(file.filename)

        if(encrypted) this.crypto.registerKey(mkey, { feed, index: path, type: Cipher.XChaCha20_Blob })
        else this.crypto.registerPublic(feed, path)

        const trie = await this.getTrie(feed)
        const { stat, contentFeed } = await this.stat(path, trie)
        
        const dataFeed = contentFeed.key.toString('hex')
        if(encrypted) this.crypto.registerKey(fkey, { feed: dataFeed, type: Cipher.ChaCha20_Stream, index: stat.offset })
        else this.crypto.registerPublic(dataFeed, stat.offset)

        return { path, trie, stat, contentFeed }
    }

    async writeableFile(filename: string, encrypted = true) {
        let vertex = latestWrite(await this.graph.queryPathAtVertex(filename, this.root).generator().destruct())
        let fileid
        const feed = this.drive.key.toString('hex')
        if (vertex) {
            const file = vertex.getContent()
            if (!file.filename) throw new Error('vertex is not of type file or directory, it does not have a filename url')
            const parsed = this.parseUrl(file.filename)
            
            if(encrypted) this.crypto.registerKey(parsed.mkey, { feed, index: parsed.path, type: Cipher.XChaCha20_Blob })
            else this.crypto.registerPublic(feed, parsed.path)
            
            fileid = parsed.path
        } else {
            vertex = this.createFile()

            if(encrypted) fileid = '/.enc/' + this.idCtr++
            else fileid = filename
        }

        let url = 'hyper://' + feed + fileid
        let fkey: Buffer | undefined
        if(encrypted) {
            const mkey = this.crypto.generateEncryptionKey(Cipher.XChaCha20_Blob)
            fkey = this.crypto.generateEncryptionKey(Cipher.ChaCha20_Stream)
            this.crypto.registerKey(mkey, {feed, type: Cipher.XChaCha20_Blob, index: fileid})
            // fkey has to be passed out to make sure the feed length isn't changed (wait until lock is set up)
            url += `?mkey=${mkey.toString('hex')}&fkey=${fkey.toString('hex')}`
        } else {
            this.crypto.registerPublic(feed, fileid)
        }
        const file = new File()
        file.filename = url
        vertex.setContent(file)
        await this.graph.put(vertex)

        const created = await this.graph.createEdgesToPath(filename, this.root, vertex)
        for(const { path } of created) {
            const dirs = await this.graph.queryPathAtVertex(path, this.root)
                .matches(v => v.getContent()?.typeName === GraphObjectTypeNames.DIRECTORY)
                .generator().destruct()
            if(dirs.length === 0) {
                //await this.drive.promises.mkdir(path) //  todo: implement or better?
            }
        }

        return {path: fileid, fkey}
    }

    private createFile(): Vertex<DriveGraphObject> {
        return this.graph.create<File>()
    }

    private stat(path, trie?): Promise<{ stat: Stat, trie: MountableHypertrie, contentFeed: Feed }> {
        const opts = { db: trie }
        return new Promise((resolve, reject) => {
            this.drive.stat(path, opts, (err, stat, trie) => {
                if (err) return reject(err)
                this.drive._getContent(trie.feed, (err, contentState) => {
                    if (err) return reject(err)
                    else resolve({ stat, trie, contentFeed: contentState.feed })
                })
            })
        })
    }

    private async getTrie(feedKey: string) {
        if (this.tries.has(feedKey)) return this.tries.get(feedKey)
        const trie = await cryptoTrie(this.drive.corestore, this.crypto, feedKey)
        this.tries.set(feedKey, trie)
        return trie
    }

    private parseUrl(url) {
        const parsed = new URL(url)
        const [feed, versionStr] = parsed.host.split('+', 2)
        const path = unixify(parsed.pathname)
        const metaKey = parsed.searchParams.get('mkey')
        const fileKey = parsed.searchParams.get('fkey')

        let mkey: Buffer | undefined, fkey: Buffer | undefined
        if (metaKey) mkey = Buffer.from(metaKey, 'hex')
        if (fileKey) fkey = Buffer.from(fileKey, 'hex')

        let version: number | undefined
        if (versionStr) version = parseInt(versionStr)

        return { feed, path, mkey, fkey, versionStr }
    }
}

function latestWrite(vertices: Vertex<DriveGraphObject>[]) {
    // TODO: use more sophisticated method
    if (!vertices || vertices.length === 0) return null
    else if (vertices.length === 1) return vertices[0]
    else return vertices.sort((a, b) => a.getTimestamp() - b.getTimestamp())[0]
}