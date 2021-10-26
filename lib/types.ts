import { Feed } from 'hyperobjects'
import { Corestore } from 'hyper-graphdb'
import codecs, { CodecInput as Codec } from 'codecs'
import { EventEmitter } from 'events'
import { ReadStream, WriteStream } from 'fs'

export interface HyperdriveError extends Error {
  errno?: number
}

export type CBF = (err?: HyperdriveError, ...args) => void
export type CB0 = (err?: HyperdriveError) => void
export type CB1<T> = (err?: HyperdriveError, arg1?: T) => void
export type CB2<T, V> = (err?: HyperdriveError, arg1?: T, arg2?: V) => void

export type encryptionOpts = { db?: { encrypted?: boolean } }
export type readdirOpts = { includeStats?: boolean; recursive?: boolean } | encryptionOpts
export type readdirResult = string | { name: string; path: string; stat: Stat }

export interface Stat {
  dev: number
  nlink: number
  rdev: number
  blksize: number
  ino: number
  mode: number
  uid: number
  gid: number
  size: number
  offset: number
  blocks: number
  atime: Date
  mtime: Date
  ctime: Date
  linkname?: string
  isFile?: boolean
  isDirectory?: boolean
  isSymlink?: boolean
}

export interface Hyperdrive extends EventEmitter {
  _writingFds: any
  key?: Buffer
  discoveryKey?: Buffer
  live: boolean
  sparse: boolean
  sparseMetadata: boolean
  corestore: Corestore
  metadata: any // TODO: interface for hypertrie
  db: any // TODO
  tags: any // TODO: interface for tags
  isCheckout: boolean

  version: number
  writeable: boolean
  contentWriteable: boolean
  peers: []
  promises: {
    // TODO: rest
    ready(): Promise<void>
    mkdir(name: string, opts?: any): Promise<void>
    readFile(name: string, opts?: ({ encoding: Codec } & any) | string): Promise<any>
    writeFile(name: string, buf, opts?: ({ encoding: Codec } & any) | string): Promise<void>
    readdir(name: string, opts?: readdirOpts): Promise<readdirResult[]>
    lstat(name: string, opts?: any): Promise<Stat>
    stat(name: string, opts?: any): Promise<Stat>
    unlink(name: string, opts?: encryptionOpts): Promise<void>
  }
  ready(cb: CBF): void
  getContent(cb: CB1<Feed>): void
  open(name: string, flags: string, cb: CB1<number>): void
  read(fd: number, buf: Buffer, offset: number, len: number, pos: number, cb: CB2<number, Buffer>): void
  write(fd: number, buf: Buffer, offset: number, len: number, pos: number, cb: CB2<number, Buffer>): void
  createReadStream(name: string, opts?: { start?: number; end?: number; length?: number; highWaterMark?: number } | encryptionOpts): ReadStream
  createDiffStream(other: Hyperdrive | number, prefix?: string, opts?: {}): ReadableStream
  createDirectoryStream(name: string, opts?: { includeStats?: boolean }): ReadableStream
  createWriteStream(name: string, opts?: any): WriteStream
  create(name: string, opts?: {} | CBF, cb?: CBF): void
  readFile(name: string, opts?: ({ encoding: Codec } & any) | string | CBF, cb?: CBF): void
  writeFile(name: string, buf, opts?: ({ encoding: Codec } & any) | string | CBF, cb?: CBF): void
  truncate(name: string, size?: number, cb?: CBF)
  ftruncate(fd: number, size?: number, cb?: CBF)
  mkdir(name: string, opts?: any | CBF, cb?: CBF)
  readlink(name: string, cb: CBF)
  lstat(name: string, opts, cb: CBF)
  stat(name: string, opts, cb: CBF)
  info(name: string, cb: CBF)
  access(name: string, opts, cb: CBF)
  exists(name: string, opts, cb: CBF)
  readdir(name: string, opts: readdirOpts, cb: CB1<readdirResult[]>)
  unlink(name: string, opts?: encryptionOpts | CB0, cb?: CB0)
  replicate(isInitiator, opts)
  checkout(version, opts)
  close(fd, cb: CBF)
  destroyStorage(cb: CBF)
  stats(path: string, opts, cb: CBF)
  watchStats(path: string, opts)
  mirror()
  clear(path: string, opts, cb: CBF)
  download(path: string, opts, cb: CBF)
  watch(name: string, onchange)
  mount(path: string, key, opts, cb: CBF)
  unmount(path: string, cb: CBF)
  symlink(target, linkName, cb: CBF)
  createMountStream(opts)
  getAllMounts(opts, cb: CBF)
  extension(name: string, message)
  registerExtension(name: string, handlers)
  setMetadata(path: string, key, value, cb: CBF)
  removeMetadata(path, key, cb: CBF)
  copy(from, to, cb: CBF)
  createTag(name: string, version, cb: CBF)
  getAllTags(cb: CBF)
  deleteTag(name: string, cb: CBF)
  getTaggedVersion(name: string, cb: CBF)

  _getContent(feed: Feed, cb: CB1<{ feed: Feed }>)
}
