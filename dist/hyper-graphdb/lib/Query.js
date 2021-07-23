"use strict";
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Query = void 0;
const Generator_1 = require("./Generator");
class Query {
    constructor(view, vertexQueries) {
        this.vertexQueries = vertexQueries;
        this.view = view;
    }
    matches(test) {
        const filtered = this.vertexQueries.filter(async (q) => await test(q));
        return this.view.query(filtered);
    }
    out(label) {
        const vertexQuery = this.vertexQueries.flatMap(async (q) => (await this.view.out(q, label)));
        return this.view.query(vertexQuery);
    }
    vertices() {
        return this.vertexQueries.destruct();
    }
    generator() {
        return this.vertexQueries;
    }
    repeat(operators, until, maxDepth) {
        const self = this;
        return this.view.query(new Generator_1.Generator(gen()));
        function gen() {
            return __asyncGenerator(this, arguments, function* gen_1() {
                let depth = 0;
                let mapped = new Array();
                let state = self;
                let queries = yield __await(self.vertexQueries.destruct());
                const results = new Array();
                while ((!maxDepth || depth < maxDepth) && (!until || until(results)) && queries.length > 0) {
                    const newVertices = yield __await(self.leftDisjoint(queries, mapped, (a, b) => a.equals(b)));
                    const subQuery = self.view.query(Generator_1.Generator.from(newVertices));
                    mapped = mapped.concat(newVertices);
                    state = yield __await(operators(subQuery));
                    queries = yield __await(state.vertexQueries.destruct());
                    for (const q of queries) {
                        yield yield __await(q);
                        results.push(q);
                    }
                    depth++;
                }
            });
        }
    }
    values(extractor) {
        return this.vertexQueries.map(async (v) => await extractor(v)).values();
    }
    async leftDisjoint(arr1, arr2, comparator) {
        const res = new Array();
        for (const v1 of arr1) {
            if (!(await contained(v1)))
                res.push(v1);
        }
        return res;
        async function contained(v1) {
            for (const v2 of arr2) {
                if (await comparator(v1, v2))
                    return true;
            }
            return false;
        }
    }
}
exports.Query = Query;
//# sourceMappingURL=Query.js.map