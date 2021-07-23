"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleGraphObject = exports.Codec = exports.GraphObject = void 0;
const messages_1 = __importDefault(require("../messages"));
class GraphObject {
    constructor(serialized) {
        if (serialized) {
            const obj = JSON.parse(serialized.toString());
            Object.assign(this, obj);
        }
    }
    serialize() {
        return Buffer.from(JSON.stringify(this));
    }
}
exports.GraphObject = GraphObject;
class Codec {
    constructor() {
        this.name = 'graphObject';
        this.impl = new Map();
    }
    encode(input) {
        return messages_1.default.GraphContent.encode({
            type: input.typeName,
            data: input.serialize()
        });
    }
    decode(input) {
        const content = messages_1.default.GraphContent.decode(input);
        if (!this.impl.has(content.type)) {
            throw new Error('Cannot decode unknown GraphObject type: ' + content.type);
        }
        const data = content.data || Uint8Array.of();
        const constr = this.impl.get(content.type);
        return constr(data);
    }
    registerImpl(constr) {
        this.impl.set(constr().typeName, constr);
    }
}
exports.Codec = Codec;
class SimpleGraphObject extends GraphObject {
    constructor(serialized) {
        super();
        this.typeName = 'Simple';
        this.properties = new Map();
        if (serialized) {
            const arr = JSON.parse(serialized.toString());
            this.properties = new Map(arr);
        }
    }
    serialize() {
        const arr = [...this.properties.entries()];
        return Buffer.from(JSON.stringify(arr));
    }
    set(key, value) {
        this.properties.set(key, value);
        return this;
    }
    get(key) {
        return this.properties.get(key);
    }
}
exports.SimpleGraphObject = SimpleGraphObject;
//# sourceMappingURL=Codec.js.map