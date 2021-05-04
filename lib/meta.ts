import { CB0, Hyperdrive, Stat } from './types'
import { CertaCryptGraph } from 'certacrypt-graph'
import { Vertex } from 'hyper-graphdb'
import { Directory, DriveGraphObject, File, GraphObjectTypeNames } from './graphObjects'
import { FileNotFound, PathAlreadyExists } from 'hyperdrive/lib/errors'
import { cryptoTrie } from './crypto'
import { Cipher, ICrypto } from 'certacrypt-crypto'
import MountableHypertrie from 'mountable-hypertrie'
import { Feed } from 'hyperobjects'
import { Stat as TrieStat } from 'hyperdrive-schemas'
import { parseUrl } from './url'
import { debug, enableDebugLogging } from './debug'


export class MetaStorage {
    private readonly drive: Hyperdrive
    private readonly graph: CertaCryptGraph
    private readonly root: Vertex<DriveGraphObject>
    private readonly tries: Map<string, MountableHypertrie>
    private readonly crypto: ICrypto
    private currentIdCtr = 0

    constructor(drive: Hyperdrive, graph: CertaCryptGraph, root: Vertex<DriveGraphObject>, crypto: ICrypto) {
        this.drive = drive
        this.graph = graph
        this.root = root
        this.crypto = crypto
        this.tries = new Map<string, MountableHypertrie>()
    }

    private async uniqueFileId() {
        const nodes = <{seq: number, key: string, value: Buffer}[]> await new Promise((resolve, reject) => this.drive.db.list('.enc', {hidden: true}, (err, res) => err ? reject(err) : resolve(res)))
        let idCtr = this.currentIdCtr + 1
        nodes.map(node => parseInt(node.key.split('/', 2)[1]))
             .forEach(id => idCtr = Math.max(idCtr, id+1))
        this.currentIdCtr = idCtr
        return '/.enc/' + idCtr
    }

    async readableFile(filename: string, encrypted = true) {
        const file = await this.find(filename)
        if (!file) throw new FileNotFound(filename)
        const { vertex, feed, path, mkey, fkey } = file

        if(encrypted) this.crypto.registerKey(mkey, { feed, index: path, type: Cipher.XChaCha20_Blob })
        else this.crypto.registerPublic(feed, path)

        const trie = await this.getTrie(feed)
        const { stat, contentFeed } = await this.lstat(path, encrypted, trie, true)
        
        const dataFeed = contentFeed.key.toString('hex')
        if(encrypted) this.crypto.registerKey(fkey, { feed: dataFeed, type: Cipher.ChaCha20_Stream, index: stat.offset })
        else this.crypto.registerPublic(dataFeed, stat.offset)

        const typeName = (<Vertex<DriveGraphObject>>vertex).getContent().typeName
        if(typeName === GraphObjectTypeNames.FILE) stat.isFile = true
        else if (typeName === GraphObjectTypeNames.DIRECTORY) stat.isDirectory = true

        debug(`created readableFile ${filename} from ${encrypted ? 'encrypted' : 'public'} ${stat.isFile ? 'file' : 'directory'} hyper://${feed}${path}`)

        return { path, trie, stat, contentFeed }
    }

    async writeableFile(filename: string, encrypted = true): Promise<{path: string, fkey?: Buffer}> {
        let parsedFile = await this.find(filename)
        let fileid: string
        let vertex: Vertex<DriveGraphObject> = parsedFile?.vertex
        const feed = this.drive.key.toString('hex')
        if (parsedFile) {
            
            if(encrypted) this.crypto.registerKey(parsedFile.mkey, { feed, index: parsedFile.path, type: Cipher.XChaCha20_Blob })
            else this.crypto.registerPublic(feed, parsedFile.path)
            
            fileid = parsedFile.path
        } else {
            vertex = this.graph.create<File>()

            if(encrypted) fileid = await this.uniqueFileId()
            else fileid = filename
        }

        let url = 'hyper://' + feed + fileid
        let fkey: Buffer
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

        debug(`created writeableFile ${filename} as ${encrypted ? 'encrypted' : 'public'} file hyper://${feed}${fileid}`)

        const created = await this.graph.createEdgesToPath(filename, this.root, vertex)
        for(const { path } of created) {
            const dirs = await this.graph.queryPathAtVertex(path, this.root)
                .matches(v => v.getContent()?.typeName === GraphObjectTypeNames.DIRECTORY)
                .generator().destruct()
            if(dirs.length === 0) {
                await this.drive.promises.mkdir(path, {db:{encrypted: true}})
            }
        }

        return {path: fileid, fkey}
    }

    public async createDirectory(name: string, makeStat: (name: string, cb: CB0) => void): Promise<Vertex<Directory>> {
        const dirs = <Vertex<DriveGraphObject>[]>  await this.graph.queryPathAtVertex(name, this.root).vertices()
        let target: Vertex<Directory>
        for (const vertex of dirs) {
            const content = vertex.getContent()
            if(content?.typeName === GraphObjectTypeNames.DIRECTORY) {
                throw new PathAlreadyExists(name)
            }
            if(content === null && vertex.getFeed() === this.root.getFeed()) {
                target = <Vertex<Directory>>vertex
            }
        }

        if(!target) {
            target = this.graph.create<Directory>()
        }
        const feed = this.drive.db.feed.key.toString('hex')
        const mkey = this.crypto.generateEncryptionKey(Cipher.XChaCha20_Blob)
        const fileid = await this.uniqueFileId()
        const url = `hyper://${feed}${fileid}?mkey=${mkey.toString('hex')}`
        const dir = new Directory()
        dir.filename = url
        target.setContent(dir)
        this.crypto.registerKey(mkey, {feed, type: Cipher.XChaCha20_Blob, index: fileid})
        
        await new Promise((resolve, reject) => makeStat.call(null, fileid, err => err ? reject(err) : resolve(undefined)))
        await this.graph.put(target)
        await this.graph.createEdgesToPath(name, this.root, target)

        debug(`created directory ${name} at hyper://${feed}${fileid}`)

        return target
    }

    public async find(path: string) {
        const vertex = latestWrite(<Vertex<DriveGraphObject>[]> await this.graph.queryPathAtVertex(path, this.root).vertices())
        if(!vertex) return null

        const file = vertex.getContent()
        if (!file) throw new Error('vertex is not of type file or directory, it has no content at all')
        if (!file.filename) throw new Error('vertex is not of type file or directory, it does not have a filename url')
        const parsed = parseUrl(file.filename)
        return {vertex, ...parsed}
    }

    public lstat(path, encrypted: boolean, trie?, file?: boolean): Promise<{ stat: Stat, trie: MountableHypertrie, contentFeed: Feed }> {
        const self = this
        const opts = { file: !!file, db: {trie, encrypted , hidden: !!encrypted} }
        return new Promise((resolve, reject) => {
            if(trie && trie !== self.drive.db) {
                trie.get(path, opts.db, onRemoteStat)   
            } else {
                this.drive.lstat(path, opts, onStat)
            }

            function onStat(err, stat, passedTrie) {
                if (err) return reject(err)
                if (stat && !passedTrie) return resolve(stat)
                self.drive._getContent(passedTrie.feed, (err, contentState) => {
                    if (err) return reject(err)
                    else resolve({ stat, trie: passedTrie, contentFeed: contentState.feed })
                })
            }

            function onRemoteStat(err, node, trie) {
                if (err) return reject(err)
                // vanilla hyperdrive mounts are not supported yet
                if (!node && opts.file) return reject(new FileNotFound(path))
                if (!node) return onStat(null, TrieStat.directory(), trie) // TODO: modes?
                try {
                    var st = TrieStat.decode(node.value)
                } catch (err) {
                    return reject(err)
                }
                const writingFd = self.drive._writingFds.get(path)
                if (writingFd) {
                    st.size = writingFd.stat.size
                }
                onStat(null, st, trie)
            }
        })
    }

    public async getTrie(feedKey: string): Promise<MountableHypertrie> {
        if (feedKey === this.drive.key.toString('hex')) return this.drive.db
        if (this.tries.has(feedKey)) return <MountableHypertrie> this.tries.get(feedKey)
        const trie = <MountableHypertrie> await cryptoTrie(this.drive.corestore, this.crypto, feedKey)
        this.tries.set(feedKey, trie)
        return trie
    }
}

function latestWrite(vertices: Vertex<DriveGraphObject>[]) {
    // TODO: use more sophisticated method - e.g. a view that makes sure there is only one vertex
    if (!vertices || vertices.length === 0) return null
    else if (vertices.length === 1) return vertices[0]
    else return vertices.sort((a, b) => a.getTimestamp() - b.getTimestamp())[0]
}