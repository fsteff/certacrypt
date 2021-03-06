"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreSharedGraphObject = exports.UserProfile = exports.UserKey = exports.Thombstone = exports.Directory = exports.File = exports.GraphObjectTypeNames = exports.DriveGraphObject = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const codecs_1 = require("codecs");
class DriveGraphObject extends hyper_graphdb_1.GraphObject {
    constructor(data) {
        super();
        if (data) {
            const decoded = codecs_1.json.decode(data);
            Object.assign(this, decoded);
        }
    }
    serialize() {
        return codecs_1.json.encode(this);
    }
}
exports.DriveGraphObject = DriveGraphObject;
var GraphObjectTypeNames;
(function (GraphObjectTypeNames) {
    GraphObjectTypeNames["DIRECTORY"] = "CertaCrypt-Directory";
    GraphObjectTypeNames["FILE"] = "CertaCrypt-File";
    GraphObjectTypeNames["THOMBSTONE"] = "CertaCrypt-Thombstone";
    GraphObjectTypeNames["USERKEY"] = "CertaCrypt-X25519Key";
    GraphObjectTypeNames["USERPROFILE"] = "CertaCrypt-Profile";
    GraphObjectTypeNames["PRESHARED"] = "CertaCrypt-PreShared";
})(GraphObjectTypeNames = exports.GraphObjectTypeNames || (exports.GraphObjectTypeNames = {}));
class File extends DriveGraphObject {
    constructor() {
        super(...arguments);
        this.typeName = GraphObjectTypeNames.FILE;
    }
}
exports.File = File;
class Directory extends DriveGraphObject {
    constructor() {
        super(...arguments);
        this.typeName = GraphObjectTypeNames.DIRECTORY;
    }
}
exports.Directory = Directory;
class Thombstone extends DriveGraphObject {
    constructor() {
        super(...arguments);
        this.typeName = GraphObjectTypeNames.THOMBSTONE;
    }
}
exports.Thombstone = Thombstone;
class UserKey extends hyper_graphdb_1.GraphObject {
    constructor(key) {
        super();
        this.key = key;
        this.typeName = GraphObjectTypeNames.USERKEY;
    }
    serialize() {
        return Buffer.from(this.key);
    }
}
exports.UserKey = UserKey;
class UserProfile extends hyper_graphdb_1.GraphObject {
    constructor(data) {
        super();
        this.typeName = GraphObjectTypeNames.USERPROFILE;
        if (data) {
            const decoded = codecs_1.json.decode(data);
            Object.assign(this, decoded);
        }
    }
    serialize() {
        return codecs_1.json.encode({ username: this.username, bio: this.bio, profilePicture: this.profilePicture, extensions: this.extensions });
    }
}
exports.UserProfile = UserProfile;
class PreSharedGraphObject extends hyper_graphdb_1.GraphObject {
    constructor(data) {
        super();
        this.typeName = GraphObjectTypeNames.PRESHARED;
        if (data) {
            const decoded = codecs_1.json.decode(data);
            Object.assign(this, decoded);
        }
        else {
            this.expiryDate = new Date().getTime() + 1000 * 3600 * 24 * 30;
        }
    }
    serialize() {
        return codecs_1.json.encode({ expiryDate: this.expiryDate });
    }
}
exports.PreSharedGraphObject = PreSharedGraphObject;
//# sourceMappingURL=graphObjects.js.map