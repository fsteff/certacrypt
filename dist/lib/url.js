"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUrl = exports.parseUrl = void 0;
const unixify_1 = __importDefault(require("unixify"));
function parseUrl(url) {
    const parsed = new URL(url);
    const [feed, versionStr] = parsed.host.split('+', 2);
    const path = unixify_1.default(parsed.pathname);
    const metaKey = parsed.searchParams.get('mkey');
    const fileKey = parsed.searchParams.get('fkey');
    const singleKey = parsed.searchParams.get('key');
    let mkey, fkey, key;
    let id, version;
    if (metaKey)
        mkey = Buffer.from(metaKey, 'hex');
    if (fileKey)
        fkey = Buffer.from(fileKey, 'hex');
    if (singleKey)
        key = Buffer.from(singleKey, 'hex');
    if (path && path.length > 1 && /^\d+$/.test(path.substr(1)))
        id = parseInt(path.substr(1));
    if (versionStr && /^\d+$/.test(versionStr))
        version = parseInt(versionStr);
    return { feed, path, id, mkey, fkey, key, version };
}
exports.parseUrl = parseUrl;
function createUrl(vertex, key, version) {
    let versionStr = version ? '+' + version : '';
    return `hyper://${vertex.getFeed()}${versionStr}/${vertex.getId()}?key=${key.toString('hex')}`;
}
exports.createUrl = createUrl;
//# sourceMappingURL=url.js.map