"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertaCrypt = void 0;
const corestore_1 = __importDefault(require("corestore"));
const hyperdrive_1 = __importDefault(require("hyperdrive"));
const hypertrie_1 = __importDefault(require("hypertrie"));
const corestore_2 = __importDefault(require("./modules/core/corestore"));
const drive_1 = __importDefault(require("./modules/core/drive"));
const url_1 = __importDefault(require("./modules/core/url"));
const graph_1 = __importDefault(require("./modules/graph"));
const Context_1 = __importDefault(require("./modules/crypto/lib/Context"));
const primitives_1 = require("./modules/crypto/lib/primitives");
const hypercore_encryption_wrapper_1 = __importDefault(require("./modules/hypercore-encryption-wrapper"));
class CertaCrypt {
    constructor(masterKey, corestore, crypto) {
        this.crypto = crypto || new Context_1.default();
        if (typeof corestore === 'string') {
            this.corestore = corestore_2.default(new corestore_1.default(corestore), this.crypto);
        }
        else {
            this.corestore = corestore_2.default(corestore, this.crypto);
        }
        const dbStore = this.corestore.default();
        const self = this;
        this.readyPromise = new Promise((resolve, reject) => {
            dbStore.ready((err) => {
                if (err)
                    reject(err);
                const feedKey = dbStore.toString('hex');
                this.crypto.prepareStream(feedKey, 0, masterKey);
                hypercore_encryption_wrapper_1.default(dbStore, this.crypto.getStreamEncryptor(feedKey), this.crypto.getStreamDecryptor(feedKey));
                self.db = hypertrie_1.default(null, null, { feed: dbStore, valueEncoding: 'json' });
                resolve();
            });
        });
    }
    async ready() {
        return this.readyPromise;
    }
    async getDrive(key, opts) {
        if (key) {
            const driveOpts = await this.getDB('drives/' + key).then((node) => node ? node.value : null);
            if (!driveOpts)
                throw new Error('no drive with key ' + key + ' found');
            const drive = hyperdrive_1.default(this.corestore, key);
            await drive.promises.ready();
            await drive_1.default(drive, self.crypto, { mainKey: driveOpts.rootKey, id: opts.id, createRoot: false });
            return drive;
        }
        else {
            const graphOpts = {
                mainKey: primitives_1.generateEncryptionKey().toString('hex'),
                id: graph_1.default.prefix(),
                createRoot: true
            };
            const drive = hyperdrive_1.default(this.corestore, key, graphOpts);
            await drive_1.default(drive, this.crypto, graphOpts);
            await this.putDB('drives/' + drive.key.toString('hex'), graphOpts);
            return drive;
        }
    }
    async getDriveFromURL(url) {
        return await url_1.default(url, this.corestore, this.crypto);
    }
    getDefaultDrive() {
        const self = this;
        return this.getDB('drives/default')
            .then((node) => {
            if (node)
                return node.value;
            else
                throw new Error('no default found');
        })
            .then(getDrive)
            .catch(createDefault);
        async function getDrive(opts) {
            const drive = hyperdrive_1.default(self.corestore, opts.key);
            await drive.promises.ready();
            await drive_1.default(drive, self.crypto, { mainKey: opts.rootKey, id: opts.id, createRoot: false });
            return drive;
        }
        async function createDefault() {
            console.warn('no default hyperdrive found - creating a new one');
            const drive = hyperdrive_1.default(self.corestore);
            await drive.promises.ready();
            const graphOpts = {
                mainKey: primitives_1.generateEncryptionKey().toString('hex'),
                id: graph_1.default.prefix(),
                createRoot: true,
            };
            const driveOpts = {
                rootKey: graphOpts.mainKey,
                id: graphOpts.id,
                key: drive.key.toString('hex')
            };
            await drive_1.default(drive, self.crypto, graphOpts);
            await self.putDB('drives/default', driveOpts);
        }
    }
    async putDB(key, value, opts) {
        const self = this;
        await this.ready();
        return new Promise((resolve, reject) => {
            self.db.put(key, value, opts, (err, ...res) => err ? reject(err) : resolve(...res));
        });
    }
    async getDB(key, opts) {
        const self = this;
        await this.ready();
        return new Promise((resolve, reject) => {
            self.db.get(key, opts, (err, ...res) => err ? reject(err) : resolve(...res));
        });
    }
    static generateMasterKey() {
        return primitives_1.generateEncryptionKey().toString('hex');
    }
}
exports.CertaCrypt = CertaCrypt;
//# sourceMappingURL=index.js.map