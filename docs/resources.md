# External Resources

List of links to relevant external resources.

## Repos/Orgs

- [Hypercore Protocol](https://github.com/hypercore-protocol)
  - [hypercore](https://github.com/hypercore-protocol/hypercore)
  - [hypertrie](https://github.com/hypercore-protocol/hypertrie)
  - [hyperdrive](https://github.com/hypercore-protocol/hyperdrive)
  - [hyperspace](https://github.com/hypercore-protocol/hyperspace)
  - [hyperspace-rpc](https://github.com/hypercore-protocol/hyperspace-rpc)
- [Hyperswarm](https://github.com/hyperswarm/)
- [Mafintosh's hyper*](https://github.com/mafintosh?tab=repositories&q=hyper&type=&language=)
  - [hypercore-streams](https://github.com/mafintosh/hypercore-streams)
  - [hyperbatch](https://github.com/mafintosh/hyperbatch)
  - [hypercore-strong-link](https://github.com/mafintosh/hypercore-strong-link)
  - [hypercore-extension-rpc](https://github.com/mafintosh/hypercore-extension-rpc)

## Standartization Efforts

- [Dat DEPs](https://github.com/datprotocol/DEPs/tree/master/proposals)
  - [0007-hypercore-header](https://github.com/datprotocol/DEPs/blob/master/proposals/0007-hypercore-header.md)
- [Hypercore Protocol HYPs](https://github.com/hypercore-protocol/hyp/tree/master/proposals)
  - [0002-hyper-url](https://github.com/hypercore-protocol/hyp/blob/master/proposals/0002-hyper-url.md)
- [issue: related feeds](https://github.com/datproject/comm-comm/issues/134#issuecomment-604806258)
- [DDEP-001: hypercore header for manifestfeed](https://github.com/playproject-io/datdot-research/issues/17#issuecomment-625902121)

## Directly related Issues & Discussions

- [issue: hiding/encrypting data](https://github.com/datprotocol/DEPs/issues/21)
- [issue: dat private key for encryption](https://github.com/datproject/discussions/issues/80)
- [issue: access rights scheme - multiple key sets (old)](https://github.com/hypercore-protocol/hyperdrive/issues/190)
- [DatFS (old)](https://github.com/fsteff/DatFS)
- [Hyperidentity (old)](https://github.com/poga/hyperidentity)

## Interesting Ideas & Projects

- [CoBox](https://gitlab.com/coboxcoop)
  - [crypto-encoder](https://gitlab.com/coboxcoop/crypto-encoder)
  - [drive kappa-drive wrappwer](https://gitlab.com/coboxcoop/drive)
  - [key-exchange](https://gitlab.com/coboxcoop/key-exchange)
- [issue: hyper:// DNS](https://github.com/beakerbrowser/beaker/discussions/1576#discussioncomment-16683)
- [kappa-db](https://github.com/kappa-db)
  - [multifeed](https://github.com/kappa-db/multifeed)
- [multi-hyperdrive](https://github.com/RangerMauve/multi-hyperdrive)
- [beakerbrowser](https://github.com/beakerbrowser/)
- [Playproject](https://playproject.io/)
  - [DatDot p2p storage solution](https://github.com/playproject-io/datdot)
  - [DatDot Research](https://github.com/playproject-io/datdot-research/tree/master/spec)
- [Ara](https://github.com/AraBlocks) (blockchain-file-sharing-system)
  - [CFSNET (old)](https://github.com/AraBlocks/cfsnet)
- [Tradle](https://github.com/tradle) (does research on hyper* stuff)
  - [hypercore FAQ](https://github.com/tradle/why-hypercore/blob/master/FAQ.md)

## Papers

- [Tahoe LaFS](https://agoric.com/assets/pdf/papers/tahoe-the-least-authority-filesystem.pdf)
- [Tresorit](https://tresorit.com/tresoritwhitepaper.pdf)
- [Local-First Software](https://storage.googleapis.com/jellyposter-store/16620200e730651d20d1a25d315508c7.pdf)
- [Capability Myths Demolished](http://www-users.cselabs.umn.edu/classes/Fall-2019/csci5271/papers/SRL2003-02.pdf)
- [Password Capability System (1986)](https://doi.org/10.1093/comjnl/29.1.1)
- [Password-Capabilites: their evolution from the pwassword-capability system into Walnut and beyond(2001)](https://doi.org/10.1109/ACAC.2001.903370)
- [A capability-based transparent cryptographic file system(2005)](https://ieeexplore.ieee.org/abstract/document/1587522)
- [A cryptographic file system for UNIX (1993)](https://dl.acm.org/doi/abs/10.1145/168588.168590)
- [CryFS Master Thesis](https://www.cryfs.org/cryfs_mathesis.pdf)
- [IVY R/W P2P Filesystem (2002)](https://dl.acm.org/doi/pdf/10.1145/844128.844132)
  - log-based P2P FS that allows multiple writers by creating "views"
  - stores data directly in a DHT
  - does conflict resolution using version vectors (where possible)
- [Eliot P2P mutable Filesystem](https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=1180204)
- [POST Cooperative Messaging System](https://www.researchgate.net/profile/Xavier_Bonnaire/publication/221150810_POST_A_Secure_Resilient_Cooperative_Messaging_System/links/09e4150b7d21c4d641000000/POST-A-Secure-Resilient-Cooperative-Messaging-System.pdf)
  - Conceptually based on IVY
  - P2P Notification "Service" for sending content-hashes and encryption keys
- [Kademlia DHT](http://people.cs.aau.dk/~bnielsen/DSE07/papers/kademlia.pdf)
- [Secure Deduplication with Converget Encryption](https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=6658753)
  - not applicable for P2P, but noteworthy
- [Sessions: E2EE conversations with minimal metadata leakage](https://arxiv.org/pdf/2002.04609)
  - Modifies Signal protocol for P2P usage
    - [X3DH Key Exchange](https://signal.org/docs/specifications/x3dh/x3dh.pdf) but with friend requests instead of prekey-bundles on central servers
  - Onion Routing Protocol

## Broader Spectrum

- [Ceph](https://developer.ibm.com/tutorials/l-ceph/)
- [Paxos Consensus](https://en.wikipedia.org/wiki/Paxos_(computer_science))
- [HLC CRDT](https://jaredforsyth.com/posts/hybrid-logical-clocks/)
- [Blogpost: What if we had local-first Software](https://adlrocha.substack.com/p/adlrocha-what-if-we-had-local-first)
- [Wiki: List of cryptographic file systems](https://en.wikipedia.org/wiki/List_of_cryptographic_file_systems)
- [gocryptfs](https://nuetzlich.net/gocryptfs/)
- [eCryptFS](https://www.ecryptfs.org)
- [CryFS](https://www.cryfs.org)
  - [Comparison of cryptographic file systems to CryFS](https://www.cryfs.org/comparison/)
- [PGP / gnupg](https://wiki.gnupg.org/)
- [securefs](https://github.com/netheril96/securefs/blob/master/docs/design.md)
- [Attribute-based encryption](https://en.wikipedia.org/wiki/Attribute-based_encryption)
- [Analysis of BitTorrent's two Kademlia-based DHTs](https://scholarship.rice.edu/bitstream/handle/1911/96357/TR07-04.pdf?sequence=1&isAllowed=y)
- [Secure Scuttlebutt Private Messages](https://ssbc.github.io/scuttlebutt-protocol-guide/#encrypting)
- [Private-Box](https://github.com/auditdrivencrypto/private-box)
  - Might be useable for constructing the Outbox functionality
  - [Issue: "ephemeral" key doesn't achive anything (in the context of ssb)](https://github.com/auditdrivencrypto/private-box/issues/6)
  => also applicable for Outbox
- [libsodium sealed box](https://doc.libsodium.org/public-key_cryptography/sealed_boxes)
- [Using Ed25519 keys for encryption](https://blog.filippo.io/using-ed25519-keys-for-encryption/)
- [Question: Same Ed25519 keypair for DH and signing](https://crypto.stackexchange.com/questions/3260/using-same-keypair-for-diffie-hellman-and-signing) (TLDR: yes, but not recommended)