import { GraphObject, Vertex } from 'hyper-graphdb'
import unixify from 'unixify'

export const URL_TYPES = {
  USER: 'user',
  SHARE: 'share',
  SPACE: 'space',
  COMMUNICATION: 'com',
  CONTACTS: 'contacts',
  FILE: 'file'
}

export type parseUrlResults = {
  feed: string
  path?: string
  id: number
  mkey?: Buffer
  fkey?: Buffer
  key?: Buffer
  version?: number
  type?: string
  name?: string
}

export function parseUrl(url: string): parseUrlResults {
  const parsed = new URL(url)
  const [feed, versionStr] = parsed.host.split('+', 2)
  const path = <string>unixify(parsed.pathname)
  const metaKey = parsed.searchParams.get('mkey')
  const fileKey = parsed.searchParams.get('fkey')
  const singleKey = parsed.searchParams.get('key')
  const type = parsed.searchParams.get('type')
  const name = parsed.searchParams.get('name')

  let mkey: Buffer | undefined, fkey: Buffer | undefined, key: Buffer | undefined
  let id: number | undefined, version: number | undefined
  if (metaKey) mkey = Buffer.from(metaKey, 'hex')
  if (fileKey) fkey = Buffer.from(fileKey, 'hex')
  if (singleKey) key = Buffer.from(singleKey, 'hex')
  if (path && path.length > 1 && /^\d+$/.test(path.substr(1))) id = parseInt(path.substr(1))
  if (versionStr && /^\d+$/.test(versionStr)) version = parseInt(versionStr)

  return { feed, path, id, mkey, fkey, key, version, type, name }
}

export function createUrl(vertex: Vertex<GraphObject>, key: Buffer, version?: number, type?: string, name?: string) {
  let versionStr = version ? '+' + version : ''
  let typeStr = type ? '&type=' + type : ''
  let nameStr = name ? '&name=' + name : ''
  return `hyper://${vertex.getFeed()}${versionStr}/${vertex.getId()}?key=${key.toString('hex')}${typeStr}${nameStr}`
}
