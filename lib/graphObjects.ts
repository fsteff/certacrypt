import { GraphObject } from 'hyper-graphdb'
import { json } from 'codecs'

export abstract class DriveGraphObject extends GraphObject {
  filename?: string
  trie?: string

  constructor(data?: Uint8Array) {
    super()

    if (data) {
      const decoded = json.decode(data)
      Object.assign(this, decoded)
    }
  }

  serialize(): Buffer {
    return json.encode(this)
  }
}

export enum GraphObjectTypeNames {
  DIRECTORY = 'CertaCrypt-Directory',
  FILE = 'CertaCrypt-File',
  THOMBSTONE = 'CertaCrypt-Thombstone'
}

export class File extends DriveGraphObject {
  readonly typeName = GraphObjectTypeNames.FILE
}

export class Directory extends DriveGraphObject {
  readonly typeName = GraphObjectTypeNames.DIRECTORY
}

export class Thombstone extends DriveGraphObject {
  readonly typeName = GraphObjectTypeNames.THOMBSTONE
}
