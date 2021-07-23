"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexDecodingError = void 0;
class VertexDecodingError extends Error {
    constructor(id, cause) {
        super('Cannot decode Vertex #' + id);
        this.cause = cause;
        this.id = id;
    }
}
exports.VertexDecodingError = VertexDecodingError;
//# sourceMappingURL=Errors.js.map