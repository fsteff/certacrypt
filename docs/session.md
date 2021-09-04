# Sessions

The entry point for an application is the root vertex of a session. The encryption key to this vertex is the master key to all data the application has access to.
Unlike as in terms of web development such a session has no expiry date or other temporal limitation.

The root vertex referts to various strictly defined vertices:

- `public` is meant to be shared with the public, an URL to that vertex represents a user/contact. It refers to a row of strictly defined vertices itself:
  - `inbox` is an [Inbox](https://github.com/fsteff/certacrypt/blob/master/docs/inbox.md).
  - `psv` (multiple edges) are the available [Pre-Shared Vertices](https://github.com/fsteff/certacrypt/blob/master/docs/preshared-vertices.md).
  - `profile` links to a vertex containing a user profile (JSON).
  - `identity` contains the user identity public key (X25519).
- `identity_secret` contains the user identity private key (X25519) and itself refers to the public key.
- `contacts` is an index of all data about other users known to the application, implemented as a View (see [Contacts](https://github.com/fsteff/certacrypt/blob/master/docs/contacts.md))
- `app` is an index of all application-specific data (which might be in a custom format). *Might* be implemented as a view.

Additionaly, there are views that simplify the development and *might* increase performance in case of materialized views:

- `shares` refers to all vertices shared with other users, that helps to keep track of which data is shared with whom and is required to enable revokation of read access to certain users.
  - `url` (multiple) refers to all shares for the share-by-url feature.
- `channels` refers to all [Communication Channels](https://github.com/fsteff/certacrypt/blob/master/docs/private-commchannel.md) in order to simplify app development.
- `spaces` refers to all [Collaboration Spaces](https://github.com/fsteff/certacrypt/blob/master/docs/multiwriter.md)

 ![sessions sketch](https://raw.githubusercontent.com/fsteff/certacrypt/master/docs/session.png)
