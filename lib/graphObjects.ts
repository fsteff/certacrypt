import { GraphObject } from '@certacrypt/hyper-graphdb'
import { json } from 'codecs'

export enum GraphObjectTypeNames {
  DIRECTORY = 'CertaCrypt-Directory',
  FILE = 'CertaCrypt-File',
  THOMBSTONE = 'CertaCrypt-Thombstone',
  USERROOT = 'CertaCrypt-UserRoot',
  USERKEY = 'CertaCrypt-X25519Key',
  USERPROFILE = 'CertaCrypt-Profile',
  PRESHARED = 'CertaCrypt-PreShared',
  JSON = 'CertaCrypt-Json',
  VIRTUAL = 'CertaCrypt-Virtual',
  SPACE = 'CertaCrypt-Space'
}

export abstract class DriveGraphObject extends GraphObject {
  filename?: string
  trie?: string
  timestamp = new Date().getUTCMilliseconds()

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

export class File extends DriveGraphObject {
  readonly typeName = GraphObjectTypeNames.FILE
}

export class Directory extends DriveGraphObject {
  readonly typeName = GraphObjectTypeNames.DIRECTORY
}

export class Thombstone extends DriveGraphObject {
  readonly typeName = GraphObjectTypeNames.THOMBSTONE
}

export class UserRoot extends GraphObject {
  readonly typeName = GraphObjectTypeNames.USERROOT
}

export class UserKey extends GraphObject {
  readonly typeName = GraphObjectTypeNames.USERKEY

  constructor(readonly key: Uint8Array) {
    super()
  }

  serialize(): Buffer {
    return Buffer.from(this.key)
  }
}

export class UserProfile extends GraphObject {
  readonly typeName = GraphObjectTypeNames.USERPROFILE
  username?: string
  bio?: string
  profilePicture?: string
  extensions?: []

  constructor(data?: Uint8Array) {
    super()

    if (data) {
      const decoded = json.decode(data)
      Object.assign(this, decoded)
    }
  }

  serialize(): Buffer {
    return json.encode({ username: this.username, bio: this.bio, profilePicture: this.profilePicture, extensions: this.extensions })
  }
}

export class PreSharedGraphObject extends GraphObject {
  readonly typeName = GraphObjectTypeNames.PRESHARED
  expiryDate: number
  owner?: string

  constructor(data?: Uint8Array) {
    super()

    if (data) {
      const decoded = json.decode(data)
      Object.assign(this, decoded)
    } else {
      this.expiryDate = new Date().getTime() + 1000 * 3600 * 24 * 30
    }
  }

  serialize(): Buffer {
    return json.encode({ expiryDate: this.expiryDate, owner: this.owner })
  }
}

export class SpaceGraphObject extends GraphObject {
  readonly typeName = GraphObjectTypeNames.SPACE
  owner: string

  constructor(data?: Uint8Array) {
    super()

    if (data) {
      const decoded = json.decode(data)
      Object.assign(this, decoded)
    }
  }

  serialize(): Buffer {
    return json.encode({ owner: this.owner })
  }
}

export class JsonGraphObject<T extends object> extends GraphObject {
  readonly typeName = GraphObjectTypeNames.JSON

  constructor(data?: Uint8Array | T) {
    super()

    if (data) {
      const decoded = data instanceof Uint8Array ? json.decode(data) : data
      Object.assign(this, decoded)
    }
  }

  serialize(): Buffer {
    const clone: any = {}
    for (const key of Object.keys(this)) {
      if (key !== 'typeName') clone[key] = this[key]
    }
    return json.encode(clone)
  }
}

export class VirtualGraphObject extends GraphObject {
  readonly typeName = GraphObjectTypeNames.VIRTUAL
  constructor(data?: any) {
    super()
    if (data) throw new Error('cannot deserialize virtual graph object')
  }

  serialize(): Buffer {
    throw new Error('cannot serialize virtual graph object')
  }
}

export type MessageType<T extends string> = { readonly type: T }
export type GraphMessage<I extends object, T extends string> = JsonGraphObject<I> & I & MessageType<T>
