"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsView = exports.Contacts = exports.FriendState = exports.CONTACTS_PATHS = exports.CONTACTS_VIEW = void 0;
const hyper_graphdb_1 = require("hyper-graphdb");
const user_1 = require("./user");
const graphObjects_1 = require("./graphObjects");
const communication_1 = require("./communication");
const url_1 = require("./url");
const debug_1 = require("./debug");
exports.CONTACTS_VIEW = 'ContactsView';
exports.CONTACTS_PATHS = {
    SOCIAL_TO_FRIENDS: 'friends',
    CONTACTS_TO_PROFILES: 'profiles'
};
var FriendState;
(function (FriendState) {
    FriendState[FriendState["NONE"] = 0] = "NONE";
    FriendState[FriendState["REQUEST_SENT"] = 1] = "REQUEST_SENT";
    FriendState[FriendState["REQUEST_RECEIVED"] = 2] = "REQUEST_RECEIVED";
    FriendState[FriendState["FRIENDS"] = 3] = "FRIENDS";
})(FriendState = exports.FriendState || (exports.FriendState = {}));
class Contacts {
    constructor(graph, socialRoot, user, cacheDb) {
        this.graph = graph;
        this.socialRoot = socialRoot;
        this.user = user;
        this.cacheDb = cacheDb;
        this.friends = this.graph
            .queryPathAtVertex(exports.CONTACTS_PATHS.SOCIAL_TO_FRIENDS, this.socialRoot)
            .generator()
            .destruct()
            .then(async (results) => {
            let friends;
            if (results.length === 0) {
                friends = this.graph.create();
                await this.graph.put(friends);
                this.socialRoot.addEdgeTo(friends, exports.CONTACTS_PATHS.SOCIAL_TO_FRIENDS);
                await this.graph.put(this.socialRoot);
            }
            else {
                friends = results[0];
            }
            return friends;
        });
    }
    async addFriend(user) {
        const friends = await this.friends;
        friends.addEdgeTo(user.publicRoot, communication_1.Communication.getUserLabel(user));
        await this.graph.put(this.socialRoot);
        const comm = await communication_1.Communication.GetOrInitUserCommunication(this.graph, this.socialRoot, this.cacheDb, this.user, user);
        await comm.sendFriendRequest(friends);
    }
    async getFriendState(user) {
        const channel = await communication_1.Communication.GetOrInitUserCommunication(this.graph, this.socialRoot, this.cacheDb, this.user, user);
        const received = (await channel.getRequests()).filter((r) => r.type === 'FriendRequest').length > 0;
        const sent = (await channel.getSentRequests()).filter((r) => r.type === 'FriendRequest').length > 0;
        if (received && sent)
            return FriendState.FRIENDS;
        else if (received)
            return FriendState.REQUEST_RECEIVED;
        else if (sent)
            return FriendState.REQUEST_SENT;
        else
            return FriendState.NONE;
    }
    async removeFriend(user) {
        const friends = await this.friends;
        const edge = friends.getEdges(communication_1.Communication.getUserLabel(user));
        friends.removeEdge(edge);
        return this.graph.put(friends);
    }
    async getFriends(err) {
        return this.graph
            .queryAtVertex(await this.friends)
            .out()
            .generator()
            .map((v) => new user_1.User(v, this.graph))
            .destruct(err || onError);
        function onError(err) {
            console.error('Failed to load Friend User: ' + err.message);
        }
    }
    async getAllContacts() {
        const view = this.graph.factory.get(exports.CONTACTS_VIEW);
        const contacts = await this.graph
            .queryPathAtVertex(exports.CONTACTS_PATHS.CONTACTS_TO_PROFILES, this.socialRoot, view)
            .out(user_1.USER_PATHS.PUBLIC_TO_PROFILE)
            .generator()
            .map((profile) => profile.getContent())
            .destruct(onError);
        const map = new Map();
        contacts.forEach((profile) => map.set(profile.publicUrl, profile));
        return [...map.values()];
        function onError(err) {
            console.error('failed to load contact profile: ' + err);
        }
    }
}
exports.Contacts = Contacts;
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
        let vertices;
        if (label === exports.CONTACTS_PATHS.CONTACTS_TO_PROFILES) {
            return this.getAllContacts(vertex);
        }
        else {
            vertices = [];
            for (const edge of edges) {
                const feed = ((_a = edge.feed) === null || _a === void 0 ? void 0 : _a.toString('hex')) || vertex.getFeed();
                // TODO: version pinning does not work yet
                vertices.push(this.get(feed, edge.ref, /*edge.version*/ undefined, edge.view, edge.metadata));
            }
        }
        return hyper_graphdb_1.Generator.from(vertices);
    }
    async getAllContacts(socialRoot) {
        const friends = await this.graph
            .queryAtVertex(socialRoot)
            .out()
            .generator()
            .map((v) => new user_1.User(v, this.graph))
            .destruct(onError);
        // TODO: caching
        // get all friends's contacts in parallel
        const promises = new Array();
        for (const friend of friends) {
            promises.push(
            // get all friends
            communication_1.Communication.GetOrInitUserCommunication(this.graph, socialRoot, this.cacheDb, this.user, friend)
                //this.graph.queryPathAtVertex(COMM_PATHS.SOCIAL_ROOT_TO_CHANNELS + '/' + Communication.getUserLabel(friend), socialRoot).generator().destruct(onError)
                .then(async (channel) => {
                const contacts = new Array();
                // get all friend requests (containing urls to their friend list)
                for (const request of await channel.getRequests()) {
                    // parse url to the friend list
                    debug_1.debug('found friend request from ' + channel.userInit.getContent().userUrl);
                    const { feed, id, key, type } = url_1.parseUrl(request.contactsUrl);
                    if (type !== url_1.URL_TYPES.CONTACTS)
                        throw new Error('URL is not of type Contacts: ' + type);
                    // load vertex from url - TODO: use existing transactions(?)
                    const userFriendsRoot = await this.graph.get(id, feed, key);
                    // get friends from list and instantiate users
                    debug_1.debug('loading friends of user ' + channel.userInit.getContent().userUrl);
                    const userFriends = this.graph
                        .queryAtVertex(userFriendsRoot, this)
                        .out()
                        .generator()
                        .map(async (vertex) => new user_1.User(await vertex, this.graph));
                    contacts.push(userFriends);
                }
                return hyper_graphdb_1.Generator.from(contacts).flatMap(async (gen) => await gen.destruct(onError));
            }));
        }
        return hyper_graphdb_1.Generator.from(promises).flatMap(async (gen) => {
            return gen.map(async (user) => {
                const profile = await user.getProfile();
                const url = user.getPublicUrl();
                debug_1.debug('loaded user profile for ' + profile.username + ' (' + url + ')');
                return new VirtualContactVertex(url, profile);
            });
        });
        function onError(err) {
            console.error('failed to load contact profile for view: ' + err.message);
        }
    }
}
exports.ContactsView = ContactsView;
class ContactProfile extends graphObjects_1.UserProfile {
}
class VirtualContactVertex {
    constructor(publicUrl, userProfile) {
        this.publicUrl = publicUrl;
        this.userProfile = userProfile;
    }
    getContent() {
        const profile = new ContactProfile();
        Object.assign(profile, { publicUrl: this.publicUrl }, this.userProfile);
        return profile;
    }
    getEdges(label) {
        throw new Error('Method not implemented.');
    }
    equals(other) {
        throw new Error('Method not implemented.');
    }
}
//# sourceMappingURL=contacts.js.map