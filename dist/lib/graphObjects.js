"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Thombstone = exports.Directory = exports.File = exports.GraphObjectTypeNames = exports.DriveGraphObject = void 0;
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
    GraphObjectTypeNames["THOMBSTONE"] = "CertaCrypt.Thombstone";
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
//# sourceMappingURL=graphObjects.js.map