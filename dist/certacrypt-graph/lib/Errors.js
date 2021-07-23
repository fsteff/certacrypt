"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoAccessError = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const hyperobjects_1 = require("hyperobjects");
class NoAccessError extends Error {
    constructor(objectId, err) {
        super(`Cannot access object ${objectId}`);
        this.cause = err;
    }
    static detectAndThrow(id, err) {
        if (err instanceof hyperobjects_1.Errors.DecodingError || err instanceof hyper_graphdb_1.Errors.VertexDecodingError)
            throw new NoAccessError(id, err);
        else
            throw err;
    }
}
exports.NoAccessError = NoAccessError;
//# sourceMappingURL=Errors.js.map