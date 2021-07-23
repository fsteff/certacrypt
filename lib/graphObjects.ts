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
  THOMBSTONE = 'CertaCrypt-Thombstone',
  USERROOT = 'CertaCrypt-UserRoot',
  USERKEY = 'CertaCrypt-X25519Key',
  USERPROFILE = 'CertaCrypt-Profile',
  PRESHARED = 'CertaCrypt-PreShared'
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
    return json.encode({ expiryDate: this.expiryDate })
  }
}
