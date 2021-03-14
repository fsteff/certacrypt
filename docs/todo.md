# Todos & Implementation Progress

## [HyperObjects](https://github.com/fsteff/hyperobjects)

- [x] implement basic object store
  - [x] transactions
  - [x] simple merge handler
- [x] transaction info (seq-nr, timestamp)
- [ ] object history*
- [ ] watch objects for changes

## [HyperGraphDB](https://github.com/fsteff/hyper-graphdb)

- [x] getting and putting nodes
- [x] queries
  - [ ] extend functionality to allow practically any queries
  - [x] filesystem-like query system
- [ ] watch for changes of graph node(s)
- [ ] update/notify vertex objects when other instance persists changes (?)
  - [ ] track objects without having problems with the gc
  - [ ] dirty flag - must not apply changes if updated somewhere else
- [ ] show history of node (using HyperObjects object history)*
- [ ] pin edges to node versions

## [HyperPubSub](https://github.com/fsteff/hyperpubsub)

- [x] basic implementation
  - [x] subscribe and publish messages
  - [x] dedicated DHT key per topic
- [ ] history*
  - [ ] research spam- & denial-of-service-proof way of keeping history
    - probably application-defined trust/reputation system
  - [ ] periodic re-transmission
  - [ ] request re-transmission

## [CertaCrypt-Crypto](https://github.com/fsteff/certacrypt-crypto)

- [x] KV store of encryption keys
- [x] encryption & decryption methods
- [ ] track usage and drop after some time

## [CertaCrypt-Graph](https://github.com/fsteff/certacrypt-graph)

- [x] **Read Access**
  - [x] reading and writing encrypted nodes
  - [x] automatic extraction of encryption keys
- [ ] referrer nodes
- [ ] **Collaboration Spaces** (write access)
  - [ ] ACL datatype definition / space referrer nodes
  - [ ] write access
    - [ ] by pointing to existing nodes
    - [ ] using referrer nodes
  - [ ] access control enforcement (which links to follow)
  - [ ] graph union views
    - [ ] last-write wins (using timestamp)
    - [ ] use a CRDT*
  - [ ] revoking write permissions
    - [ ] removing edges to the nodes
    - [ ] pinning vertex versions
- [ ] **Inbox**
  - [ ] sealed box *envelopes*
  - [ ] implement using referrer nodes
  - [ ] notify others by using [hyperpubsub](https://github.com/fsteff/hyperpubsub)
    - [ ] sketch out how pinning of friend's messages could work*
    - [ ] implement pinning of friend's messages (see hyperpubsub history)*
- [ ] **Communication Channel**
  - [ ] sketch concept
- [ ] **Revoking Permissions**
  - [ ] removing write permissions (see collaboration spaces)
  - [ ] removing read permissions
    - [ ] creating a new key for a node
    - [ ] rewriting parts of a graph
      - [ ] differentiate between types of nodes (files, directories)
            by passing a query or list of nodes
  - [ ] provide information on who is able to read something

## CertaCrypt Drive

- [x] basic implementation of reading and writing encrypted files
- [ ] refactor using CertaCrypt-Graph
  - [x] createReadStream
  - [x] createWriteStream
  - [ ] mkdir
  - [ ] lstat
  - [ ] readdir
  - [ ] ... other utility functions?
- [ ] stream file type (hypercore)
- [ ] expose permission api (here?)

## CertaCrypt High-Level API

- [ ]  **Basic Hierachies**
  Internal graph structures that persists and organizes data - the *glue* between the features
  - [ ]  public data (shareable by id+key link)
  - [ ]  track access permissions & collaboration spaces
  - [ ]  contacts & friends
- [ ] **Session Management**
  - [ ] encrypted, private DB for storing the application state
  - [ ] utility functions that use the DB if possible or else re-compute the state from the graph
    - application state can be re-computed even if the DB is deleted (but might be slow)
    - a lot of caching on that layer
    - [ ] generate & parse URLs
    - [ ] more detailed user & friend management (inbox + communication + spaces)
- [ ] easy-to-use read & write permissions API
- [ ] [CTZN](https://github.com/pfrazee/ctzn) integration*
  - [ ] for user management / PKI
  - [ ] provide DB layer for CTZN (???)

## Certacrypt Filemanager

- [ ] *explorer-like* view
  - [ ] simple view
  - [ ] previews*
    - [ ] images
    - [ ] videos
    - [ ] markdown
  - [ ] show permissions
- [ ] sharing files & directories per URL
- [ ] contacts
  - [ ] public profile
  - [ ] friends & friend lists
  - [ ] address book of all known users
- [ ] collaboration spaces
  - [ ] show as directory, but mark as space
  - [ ] configuration dialogue
- [ ] changes-feed*
- [ ] groups*

\* likely a post-thesis feature
