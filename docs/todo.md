# Todos & Implementation Progress

## [HyperObjects](https://github.com/fsteff/hyperobjects)

- [x] implement basic object store
  - [x] transactions
  - [x] simple merge handler
- [ ] transaction info (seq-nr, timestamp)
- [ ] object history*
- [ ] watch objects for changes

## [HyperGraphDB](https://github.com/fsteff/hyper-graphdb)

- [x] getting and putting nodes
- [x] queries
  - [ ] make more powerful
  - [ ] filesystem-like query system
- [ ] watch for changes of graph node(s)
- [ ] show history of node (using HyperObjects object history)*
- [ ] pin edges to node versions

## [HyperPubSub](https://github.com/fsteff/hyperpubsub)

- [x] basic implementation
  - [x] subscribe and publish messages
  - [x] dedicated DHT key per topic
- [ ] history
  - [ ] research spam- & denial-of-service-proof way of keeping history
    - probably application-defined trust/reputation system
  - [ ] periodic re-transmission
  - [ ] request re-transmission

## [CertaCrypt-Crypto](https://github.com/fsteff/certacrypt-crypto)

- [x] KV store of encryption keys
- [x] encryption & decryption methods
- [ ] track usage and drop after some time

## [CertaCrypt-Graph](https://github.com/fsteff/certacrypt-graph)

- [x] reading and writing encrypted nodes
- [x] automatic extraction of encryption keys
- [ ] referrer nodes
- [ ] write access
  - [x] by pointing to existing nodes
  - [ ] using referrer nodes
- [ ] graph union views
  - [ ] last-write wins (using timestamp)
  - [ ] use a CRDT*
- [ ] **Inbox**
  - [ ] sealed box *envelopes*
  - [ ] implement using referrer nodes
  - [ ] notify others by using [hyperpubsub](https://github.com/fsteff/hyperpubsub)
    - [ ] sketch out how pinning of friend's messages could work
    - [ ] implement pinning of friend's messages (see hyperpubsub history)
- [ ] **Communication Channel**
  - [ ] sketch concept
- [ ] **Revoking Permissions**
  - [ ] remove write permissions
    - [x] by removing edges
    - [ ] by pinning to versions
  - [ ] removing read permissions
    - [ ] creating a new key for a node
    - [ ] rewriting parts of a graph
      - [ ] differentiate between types of nodes (files, directories)
            by passing a query or list of nodes
  - [ ] provide information on who is able to read something

## CertaCrypt Drive

- [x] basic implementation of reading and writing encrypted files
- [ ] refactor using CertaCrypt-Graph
- [ ] stream file type (hypercore)
- [ ] expose permission api (here?)

## CertaCrypt High-Level API

- [ ]  basic hierachies
  - [ ]  public data (shareable by id+key link)
  - [ ]  track access permissions
  - [ ]  contacts & friends
- [ ] utility functions
  - [ ] generate URLs
  - [ ] parse URLs  
- [ ] simple read&write permissions API
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
- [ ] sharing files & directories with users
- [ ] changes-feed*
- [ ] groups*

\* likely a post-thesis feature
