"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
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
exports.Generator = void 0;
const streamx_1 = require("streamx");
class Generator {
    constructor(gen) {
        this.gen = gen;
    }
    values(onError) {
        return this.handleOrThrowErrors(onError);
    }
    async destruct(onError) {
        var e_1, _a;
        const arr = new Array();
        try {
            for (var _b = __asyncValues(this.gen), _c; _c = await _b.next(), !_c.done;) {
                const elem = _c.value;
                if (elem instanceof Error && onError)
                    onError(elem);
                else if (elem instanceof Error)
                    throw elem;
                else
                    arr.push(elem);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return arr;
    }
    stream(onError) {
        return streamx_1.Readable.from(this.handleOrThrowErrors(onError));
    }
    filter(predicate) {
        const self = this;
        return new Generator(filter());
        function filter() {
            return __asyncGenerator(this, arguments, function* filter_1() {
                var e_2, _a;
                try {
                    for (var _b = __asyncValues(self.gen), _c; _c = yield __await(_b.next()), !_c.done;) {
                        const elem = _c.value;
                        if (elem instanceof Error)
                            yield yield __await(elem);
                        else if (yield __await(predicate(elem)))
                            yield yield __await(elem);
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) yield __await(_a.call(_b));
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            });
        }
    }
    map(mapper) {
        const self = this;
        return new Generator(map());
        function map() {
            return __asyncGenerator(this, arguments, function* map_1() {
                var e_3, _a;
                try {
                    for (var _b = __asyncValues(self.gen), _c; _c = yield __await(_b.next()), !_c.done;) {
                        const elem = _c.value;
                        if (elem instanceof Error)
                            yield yield __await(elem);
                        else
                            yield yield __await(yield __await(self.wrapAsync(mapper, elem).catch(err => err))); // converts thrown error to Error even if the mapper is not async
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) yield __await(_a.call(_b));
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            });
        }
    }
    flatMap(mapper) {
        const self = this;
        return new Generator(map());
        function map() {
            return __asyncGenerator(this, arguments, function* map_2() {
                var e_4, _a, e_5, _b;
                try {
                    for (var _c = __asyncValues(self.gen), _d; _d = yield __await(_c.next()), !_d.done;) {
                        const elem = _d.value;
                        if (elem instanceof Error) {
                            yield yield __await(elem);
                        }
                        else {
                            let mapped = yield __await(self.wrapAsync(mapper, elem).catch(err => err));
                            if (mapped instanceof Error) {
                                yield yield __await(mapped);
                            }
                            else if (mapped instanceof Generator) {
                                try {
                                    for (var _e = (e_5 = void 0, __asyncValues(mapped.gen)), _f; _f = yield __await(_e.next()), !_f.done;) {
                                        const res = _f.value;
                                        yield yield __await(res);
                                    }
                                }
                                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                                finally {
                                    try {
                                        if (_f && !_f.done && (_b = _e.return)) yield __await(_b.call(_e));
                                    }
                                    finally { if (e_5) throw e_5.error; }
                                }
                            }
                            else if (Array.isArray(mapped)) {
                                for (const res of mapped) {
                                    yield yield __await(res);
                                }
                            }
                            else {
                                yield yield __await(new Error('mapper did not return Array or Generator'));
                            }
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) yield __await(_a.call(_c));
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            });
        }
    }
    static from(promises) {
        return new Generator(generate());
        function generate() {
            return __asyncGenerator(this, arguments, function* generate_1() {
                for (const p of promises) {
                    try {
                        yield yield __await(yield __await(p));
                    }
                    catch (err) {
                        if (err instanceof Error)
                            yield yield __await(err);
                        else
                            yield yield __await(new Error(err));
                    }
                }
            });
        }
    }
    handleOrThrowErrors(onError) {
        const self = this;
        return generate();
        function generate() {
            return __asyncGenerator(this, arguments, function* generate_2() {
                var e_6, _a;
                try {
                    for (var _b = __asyncValues(self.gen), _c; _c = yield __await(_b.next()), !_c.done;) {
                        const elem = _c.value;
                        if (elem instanceof Error && onError)
                            onError(elem);
                        else if (elem instanceof Error)
                            throw elem;
                        else
                            yield yield __await(elem);
                    }
                }
                catch (e_6_1) { e_6 = { error: e_6_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) yield __await(_a.call(_b));
                    }
                    finally { if (e_6) throw e_6.error; }
                }
            });
        }
    }
    async wrapAsync(foo, ...args) {
        return foo(...args);
    }
}
exports.Generator = Generator;
//# sourceMappingURL=Generator.js.map