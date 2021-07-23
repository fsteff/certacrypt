"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Crawler {
    constructor(db) {
        this.mapped = new Set();
        this.indexes = new Array();
        this.db = db;
        this.processPromise = Promise.resolve();
    }
    registerIndex(index) {
        this.indexes.push(index);
    }
    async crawl(feed, id, contentEncoding) {
        await this.processPromise;
        let resolveCrawling, rejectCrawling;
        this.processPromise = new Promise((resolve, reject) => { resolveCrawling = resolve; rejectCrawling = reject; });
        try {
            const v = await this.db.get(feed, id, contentEncoding);
            await this.deepAwait(this.process(v, feed, contentEncoding));
            resolveCrawling();
        }
        catch (e) {
            rejectCrawling(e);
            throw e;
        }
    }
    process(vertex, feed, contentEncoding) {
        const id = feed + '@' + vertex.getId();
        if (this.mapped.has(id)) {
            return [];
        }
        else {
            this.mapped.add(id);
        }
        const promises = vertex.getEdges().map(async (edge) => {
            var _a;
            const f = ((_a = edge.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) || feed;
            const v = await this.db.get(f, edge.ref, contentEncoding);
            for (const idx of this.indexes) {
                idx.onVertex(v, feed, edge);
            }
            return this.process(v, f, contentEncoding);
        });
        return promises;
    }
    async deepAwait(input) {
        const stack = [...input];
        while (stack.length) {
            const next = stack.pop();
            if (Array.isArray(next)) {
                stack.push(...next);
            }
            else {
                let value = await next;
                if (value && Array.isArray(value)) {
                    stack.push(...value);
                }
            }
        }
    }
}
exports.default = Crawler;
//# sourceMappingURL=Crawler.js.map