"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphObjects_1 = require("../lib/graphObjects");
const simulator_1 = __importDefault(require("hyperspace/simulator"));
const tape_1 = __importDefault(require("tape"));
const certacrypt_crypto_1 = require("certacrypt-crypto");
const __1 = require("..");
const encryptedOpts = { db: { encrypted: true }, encoding: 'utf-8' };
async function createCertaCrypt(client) {
    await client.ready();
    const store = client.corestore();
    await store.ready();
    const crypto = new certacrypt_crypto_1.DefaultCrypto();
    const certacrypt = new __1.CertaCrypt(store, crypto);
    return { store, crypto, certacrypt };
}
tape_1.default('temp drive write and read', async (t) => {
    const { client, server, cleanup } = await simulator_1.default();
    const { store, crypto, certacrypt } = await createCertaCrypt(client);
    const root = certacrypt.graph.create();
    root.setContent(new graphObjects_1.Directory());
    await certacrypt.graph.put(root);
    const approot = await certacrypt.path('/apps');
    approot.addEdgeTo(root, 'test');
    await certacrypt.graph.put(approot);
    const drive = await certacrypt.drive(root);
    await drive.promises.writeFile('test.txt', 'test', encryptedOpts);
    let url = certacrypt.getFileUrl(await certacrypt.path('/apps/test/test.txt'), 'test.txt');
    const file = await certacrypt.getFileByUrl(url);
    const content = await file.readFile(encryptedOpts);
    cleanup();
    t.equals(content, 'test');
});
//# sourceMappingURL=temp.js.map