"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewFactory = void 0;
class ViewFactory {
    constructor(db, codec) {
        this.views = new Map();
        this.db = db;
        this.codec = codec;
    }
    // TODO: implement caching
    get(name, transactions) {
        const constr = this.views.get(name);
        if (!constr)
            throw new Error(`View of type ${name} not found in ViewFactory`);
        return constr(this.db, this.codec, transactions);
    }
    register(name, constr) {
        this.views.set(name, constr);
    }
}
exports.ViewFactory = ViewFactory;
//# sourceMappingURL=ViewFactory.js.map