"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = exports.USER_PATHS = void 0;
const certacrypt_crypto_1 = require("certacrypt-crypto");
const graphObjects_1 = require("./graphObjects");
const referrer_1 = require("./referrer");
const inbox_1 = require("./inbox");
const url_1 = require("./url");
exports.USER_PATHS = {
    PUBLIC: 'public',
    IDENTITY_SECRET: 'identity_secret',
    PUBLIC_TO_IDENTITY: 'identity',
    IDENTITY_SECRET_TO_PUB: 'pub',
    PUBLIC_TO_PSV: 'psv',
    PUBLIC_TO_PROFILE: 'profile',
    PUBLIC_TO_INBOX: 'inbox'
};
class User {
    constructor(publicRoot, graph, identitySecret) {
        var _a;
        this.publicRoot = publicRoot;
        this.graph = graph;
        this.identitySecret = identitySecret;
        this.crypto = this.graph.core.crypto;
        if (((_a = publicRoot.getContent()) === null || _a === void 0 ? void 0 : _a.typeName) !== graphObjects_1.GraphObjectTypeNames.USERROOT) {
            throw new Error('passed vertex is not of type UserRoot');
        }
        this.identity = graph
            .queryAtVertex(this.publicRoot)
            .out(exports.USER_PATHS.PUBLIC_TO_IDENTITY)
            .matches((v) => !!v.getContent() && v.getContent().typeName === graphObjects_1.GraphObjectTypeNames.USERKEY)
            .generator()
            .destruct(onError)
            .then((results) => {
            if (results.length === 0) {
                return Promise.reject(new Error('User Root has no Identity vertex'));
            }
            else {
                const identity = results[0];
                if (identitySecret) {
                    const secret = Buffer.from(this.identitySecret.getContent().key);
                    const pub = Buffer.from(identity.getContent().key);
                    this.crypto.registerUserKeyPair(pub, secret);
                }
                return identity;
            }
        });
        function onError(err) {
            console.error('Failed to load user Identity: ' + err);
        }
    }
    static async InitUser(graph, sessionRoot) {
        const inboxVertex = graph.create();
        const keys = certacrypt_crypto_1.Primitives.generateUserKeyPair();
        const identity = graph.create();
        identity.setContent(new graphObjects_1.UserKey(keys.pubkey));
        await graph.put([identity, inboxVertex]);
        const identitySecret = graph.create();
        identitySecret.setContent(new graphObjects_1.UserKey(keys.secretkey));
        const publicRoot = graph.create();
        publicRoot.setContent(new graphObjects_1.UserRoot());
        publicRoot.addEdgeTo(inboxVertex, exports.USER_PATHS.PUBLIC_TO_INBOX);
        publicRoot.addEdgeTo(identity, exports.USER_PATHS.PUBLIC_TO_IDENTITY);
        identitySecret.addEdgeTo(identity, exports.USER_PATHS.IDENTITY_SECRET_TO_PUB);
        await graph.put([publicRoot, identitySecret]);
        sessionRoot.addEdgeTo(publicRoot, exports.USER_PATHS.PUBLIC);
        sessionRoot.addEdgeTo(identitySecret, exports.USER_PATHS.IDENTITY_SECRET);
        await graph.put(sessionRoot);
        const user = new User(publicRoot, graph, identitySecret);
        await user.updatePresharedVertices();
        return user;
    }
    async getInbox(update = false) {
        if (update) {
            const feed = await this.graph.core.getStore(this.publicRoot.getFeed());
            await feed.feed.update(this.publicRoot.getVersion(), 500).catch((err) => console.log(err.message));
        }
        const inboxVertex = await this.graph
            .queryAtVertex(this.publicRoot)
            .out(exports.USER_PATHS.PUBLIC_TO_INBOX)
            .vertices()
            .then((results) => {
            if (results.length === 0) {
                throw new Error('User Root has no Inbox vertex');
            }
            return results[0];
        });
        return new inbox_1.Inbox(this.crypto, this.graph, inboxVertex);
    }
    async getPublicKey() {
        return Buffer.from((await this.identity).getContent().key);
    }
    getSecretKey() {
        var _a, _b;
        let key = (_b = (_a = this.identitySecret) === null || _a === void 0 ? void 0 : _a.getContent()) === null || _b === void 0 ? void 0 : _b.key;
        if (key)
            return Buffer.from(key);
        else
            return null;
    }
    getPublicUrl() {
        return url_1.createUrl(this.publicRoot, this.graph.getKey(this.publicRoot), undefined, url_1.URL_TYPES.USER);
    }
    isWriteable() {
        return this.publicRoot.getWriteable();
    }
    async updatePresharedVertices() {
        var _a;
        let vertices = await this.queryPresharedVertices();
        // TODO: remove (but persist elsewhere) outdated psv
        if (!Array.isArray(vertices) || vertices.length === 0 || ((_a = vertices[0].getContent()) === null || _a === void 0 ? void 0 : _a.expiryDate) < new Date().getUTCSeconds()) {
            const psv1 = this.graph.create();
            const psv2 = this.graph.create();
            const psv3 = this.graph.create();
            const me = this.getPublicUrl();
            const psvObj = new graphObjects_1.PreSharedGraphObject();
            psvObj.owner = me;
            psv1.setContent(psvObj);
            psv2.setContent(psvObj);
            psv3.setContent(psvObj);
            await this.graph.put([psv1, psv2, psv3]);
            this.publicRoot.addEdgeTo(psv1, exports.USER_PATHS.PUBLIC_TO_PSV);
            this.publicRoot.addEdgeTo(psv2, exports.USER_PATHS.PUBLIC_TO_PSV);
            this.publicRoot.addEdgeTo(psv3, exports.USER_PATHS.PUBLIC_TO_PSV);
            await this.graph.put(this.publicRoot);
            vertices = [psv1, psv2, psv3];
        }
        return vertices;
    }
    async setProfile(profile) {
        if (!this.publicRoot.getWriteable())
            throw new Error('cannot write profile, hypercore is not writeable');
        if (!(profile instanceof graphObjects_1.UserProfile))
            throw new Error('profile has to be of type UserProfile');
        let vertex = await this.graph
            .queryAtVertex(this.publicRoot)
            .out(exports.USER_PATHS.PUBLIC_TO_PROFILE)
            .vertices()
            .then((results) => (results.length > 0 ? results[0] : undefined));
        if (vertex) {
            vertex.setContent(profile);
            await this.graph.put(vertex);
        }
        if (!vertex) {
            vertex = this.graph.create();
            vertex.setContent(profile);
            await this.graph.put(vertex);
            this.publicRoot.addEdgeTo(vertex, exports.USER_PATHS.PUBLIC_TO_PROFILE);
            await this.graph.put(this.publicRoot);
        }
    }
    async getProfile() {
        //await this.graph.updateVertex(this.publicRoot)
        let results = await this.graph.queryAtVertex(this.publicRoot).out(exports.USER_PATHS.PUBLIC_TO_PROFILE).vertices();
        for (const profileVertex of results) {
            const profile = profileVertex.getContent();
            if ((profile === null || profile === void 0 ? void 0 : profile.typeName) === graphObjects_1.GraphObjectTypeNames.USERPROFILE) {
                return profile;
            }
        }
    }
    async queryPresharedVertices() {
        let vertices = await this.graph
            .queryAtVertex(this.publicRoot)
            .out(exports.USER_PATHS.PUBLIC_TO_PSV)
            .matches((v) => !!v.getContent() && v.getContent().typeName === graphObjects_1.GraphObjectTypeNames.PRESHARED)
            .vertices();
        vertices.sort((v1, v2) => v2.getContent().expiryDate - v1.getContent().expiryDate);
        if (vertices.length === 0)
            return undefined;
        return vertices;
    }
    async choosePreSharedVertice() {
        let vertices = await this.queryPresharedVertices();
        if (!vertices || vertices.length === 0)
            return undefined;
        const now = new Date().getTime();
        if (vertices[0].getContent().expiryDate > now) {
            vertices = vertices.filter((v) => v.getContent().expiryDate > now);
        }
        return vertices[Math.floor(Math.random() * vertices.length)];
    }
    async referToPresharedVertex(from, label, restrictions) {
        if (!from.getWriteable())
            throw new Error('Cannot refer to preshared vertex, referring vertex is not writeable');
        const target = await this.choosePreSharedVertice();
        if (!target)
            throw new Error("Cannot refer to preshared vertex, user doesn't provide any");
        const refKey = certacrypt_crypto_1.Primitives.generateEncryptionKey();
        const refLabel = certacrypt_crypto_1.Primitives.generateEncryptionKey();
        const edge = {
            label,
            ref: target.getId(),
            feed: Buffer.from(target.getFeed(), 'hex'),
            view: referrer_1.REFERRER_VIEW,
            metadata: { key: this.graph.getKey(target), refKey, refLabel },
            restrictions
        };
        from.addEdge(edge);
        await this.graph.put(from);
    }
    async writeToPresharedVertex(referrer) {
        const refData = referrer.metadata;
        if (!refData || !refData.key || !refData.refKey || !refData.refLabel) {
            throw new Error('ReferrerEdge does not contain required properties: ' + JSON.stringify(referrer));
        }
        const psv = await this.graph.get(referrer.ref, referrer.feed, refData.key);
        if (!psv.getWriteable()) {
            throw new Error('Cannot write to preshared vertex, it is not writeable');
        }
        const target = this.graph.create();
        await this.graph.put(target);
        this.crypto.registerKey(refData.refKey, { feed: target.getFeed(), index: target.getId(), type: certacrypt_crypto_1.Cipher.ChaCha20_Stream });
        const edge = {
            ref: target.getId(),
            feed: Buffer.from(target.getFeed(), 'hex'),
            label: refData.refLabel.toString('base64')
        };
        psv.addEdge(edge);
        await this.graph.put([target, psv]);
        return target;
    }
}
exports.User = User;
//# sourceMappingURL=user.js.map