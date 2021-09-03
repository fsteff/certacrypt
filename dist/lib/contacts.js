"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsView = exports.CONTACTS_PATHS = exports.CONTACTS_VIEW = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const user_1 = require("./user");
exports.CONTACTS_VIEW = 'ContactsView';
exports.CONTACTS_PATHS = {
    FRIENDS: '/friends'
};
class Contacts {
    constructor(graph, root) {
        this.graph = graph;
        this.root = root;
    }
    async addContact(user) {
        this.root.addEdgeTo(user.publicRoot, exports.CONTACTS_PATHS.FRIENDS);
        return this.graph.put(this.root);
    }
    async removeContact(user) {
        const edge = this.root
            .getEdges(exports.CONTACTS_PATHS.FRIENDS)
            .filter((e) => { var _a; return ((_a = e.feed) === null || _a === void 0 ? void 0 : _a.equals(Buffer.from(user.publicRoot.getFeed(), 'hex'))) && e.ref == user.publicRoot.getId(); });
        this.root.removeEdge(edge);
        return this.graph.put(this.root);
    }
    async getContacts(err) {
        return this.graph
            .queryAtVertex(this.root)
            .out(exports.CONTACTS_PATHS.FRIENDS)
            .generator()
            .map((v) => new user_1.User(v, this.graph))
            .destruct(err || onError);
        function onError(err) {
            console.error('Failed to load Contact User: ' + err.message);
        }
    }
}
class ContactsView extends hyper_graphdb_1.View {
    constructor(cacheDb, graph, user, contentEncoding, factory, transactions) {
        super(graph.core, contentEncoding, factory, transactions);
        this.cacheDb = cacheDb;
        this.graph = graph;
        this.user = user;
        this.viewName = exports.CONTACTS_VIEW;
    }
    async out(vertex, label) {
        var _a;
        if (!(vertex instanceof hyper_graphdb_1.Vertex) || !vertex.getFeed()) {
            throw new Error('ContactsView.out does only accept persisted Vertex instances as input');
        }
        const edges = vertex.getEdges(label);
        const vertices = new Array();
        for (const edge of edges) {
            const feed = ((_a = edge.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) || vertex.getFeed();
            // TODO: version pinning does not work yet
            vertices.push(this.get(feed, edge.ref, /*edge.version*/ undefined, edge.view, edge.metadata));
        }
        return hyper_graphdb_1.Generator.from(vertices);
    }
}
exports.ContactsView = ContactsView;
//# sourceMappingURL=contacts.js.map