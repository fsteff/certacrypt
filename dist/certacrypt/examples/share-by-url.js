"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const certacrypt_crypto_1 = require("certacrypt-crypto");
const hyperspace_1 = require("hyperspace");
const simulator_1 = __importDefault(require("hyperspace/simulator"));
const __1 = require("..");
const promises_1 = __importDefault(require("fs/promises"));
const unixify_1 = __importDefault(require("unixify"));
const url_1 = require("../lib/url");
let server;
let close;
startHyperspace()
    .then(startCertaCrypt)
    .then(runApp)
    .then(() => close())
    .catch((err) => console.error(err));
async function runApp(app) {
    switch (process.argv[2]) {
        case 'start':
            await start(app);
            break;
        case 'open':
            await open(app);
            break;
    }
}
async function open(app) {
    let url = process.argv[3];
    if (!url)
        throw new Error('no URL specified');
    let target = process.argv[4];
    if (!target)
        throw new Error('no target file specified');
    await app.mountShare(await app.path('/apps'), 'shared', url);
    const dir = await app.path('/apps/shared');
    const drive = await app.drive(dir);
    const files = await drive.promises.readdir('/', { db: { encrypted: true } });
    console.log('found files: ' + files);
    const content = await drive.promises.readFile('/' + files[0]);
    await promises_1.default.writeFile(target, content);
}
async function start(app) {
    if (!process.argv[3])
        throw new Error('argument 3 not specified');
    let file = unixify_1.default(process.argv[3]);
    const content = await promises_1.default.readFile(file, 'utf-8');
    const path = file.split('/');
    const filename = path[path.length - 1];
    const appRoot = await app.path('/apps');
    let driveRoot;
    if (appRoot.getEdges('drive').length === 0) {
        driveRoot = app.graph.create();
        await app.graph.put(driveRoot);
        appRoot.addEdgeTo(driveRoot, 'drive');
        await app.graph.put(appRoot);
    }
    else {
        driveRoot = await app.path('/apps/drive');
    }
    const drive = await app.drive(driveRoot);
    await drive.promises.writeFile(filename, content);
    console.log('file successfully written');
    const share = await app.share(driveRoot);
    const url = url_1.createUrl(share, app.graph.getKey(share));
    console.log('drive can be shared using the url ' + url);
    console.log('press any key to end program...');
    process.stdin.once('data', () => process.exit());
}
async function startHyperspace() {
    if (process.argv[1] === 'open') {
        const { client, cleanup } = await simulator_1.default();
        close = cleanup;
        return client;
    }
    let corestore;
    try {
        let client = new hyperspace_1.Client();
        await client.ready();
        corestore = client.corestore();
    }
    catch (e) {
        server = new hyperspace_1.Server();
        await server.ready();
        close = () => server.stop();
        let client = new hyperspace_1.Client();
        await client.ready();
        corestore = client.corestore();
    }
    return corestore.namespace('certacrypt example');
}
async function startCertaCrypt(corestore) {
    let session;
    switch (process.argv[2]) {
        case 'start':
            session = process.argv[4];
            break;
        case 'open':
            break;
        default:
            console.error('no command specified');
            console.log(process.argv);
            process.exit();
    }
    return new __1.CertaCrypt(corestore, new certacrypt_crypto_1.DefaultCrypto(), session);
}
//# sourceMappingURL=share-by-url.js.map