# External Resources

List of links to relevant external resources.

## 1. Repos/Orgs

- [Hypercore Protocol](https://github.com/hypercore-protocol)
  - [hypercore](https://github.com/hypercore-protocol/hypercore)
  - [hypertrie](https://github.com/hypercore-protocol/hypertrie)
  - [hyperdrive](https://github.com/hypercore-protocol/hyperdrive)
  - [hyperspace](https://github.com/hypercore-protocol/hyperspace)
    - [locking api for RemoteHypercore](https://github.com/hypercore-protocol/hyperspace/blob/26d6d36f3d3f9d6ca1269994af5a2ddf9096c583/test/local.js#L311)
  - [hyperspace-rpc](https://github.com/hypercore-protocol/hyperspace-rpc)
- [Hyperswarm](https://github.com/hyperswarm/)
- [Mafintosh's hyper*](https://github.com/mafintosh?tab=repositories&q=hyper&type=&language=)
  - [hypercore-streams](https://github.com/mafintosh/hypercore-streams)
  - [hyperbatch](https://github.com/mafintosh/hyperbatch)
  - [hypercore-strong-link](https://github.com/mafintosh/hypercore-strong-link)
  - [hypercore-extension-rpc](https://github.com/mafintosh/hypercore-extension-rpc)

## 2. Standartization Efforts

- [Dat DEPs](https://github.com/datprotocol/DEPs/tree/master/proposals)
  - [0007-hypercore-header](https://github.com/datprotocol/DEPs/blob/master/proposals/0007-hypercore-header.md)
- [Hypercore Protocol HYPs](https://github.com/hypercore-protocol/hyp/tree/master/proposals)
  - [0002-hyper-url](https://github.com/hypercore-protocol/hyp/blob/master/proposals/0002-hyper-url.md)
- [issue: related feeds](https://github.com/datproject/comm-comm/issues/134#issuecomment-604806258)
- [DDEP-001: hypercore header for manifestfeed](https://github.com/playproject-io/datdot-research/issues/17#issuecomment-625902121)

## 3. Directly related Issues & Discussions

- [issue: hiding/encrypting data](https://github.com/datprotocol/DEPs/issues/21)
- [issue: dat private key for encryption](https://github.com/datproject/discussions/issues/80)
- [issue: access rights scheme - multiple key sets (old)](https://github.com/hypercore-protocol/hyperdrive/issues/190)
- [DatFS (old)](https://github.com/fsteff/DatFS)
- [Hyperidentity (old)](https://github.com/poga/hyperidentity)

## 4. Interesting Ideas & Projects

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

## 5. Papers

### 5.1 Cryptographic Filesystems

- [A cryptographic file system for UNIX (1993)](https://dl.acm.org/doi/abs/10.1145/168588.168590)
- [CryFS Master Thesis](https://www.cryfs.org/cryfs_mathesis.pdf)

### 5.2 P2P Filesystems

- [IVY R/W P2P Filesystem (2002)](https://dl.acm.org/doi/pdf/10.1145/844128.844132)
  - log-based P2P FS that allows multiple writers by creating "views"
  - stores data directly in a DHT
  - does conflict resolution using version vectors (where possible)
- [Eliot P2P mutable Filesystem](https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=1180204)
- Bittorent
  - [BEP-44 Storing arbitrary data in the DHT](http://bittorrent.org/beps/bep_0044.html) DHT key is the public key for signing the data instead of a content hash
  - [BEP-46 Updating Torrents via DHT Mutable Items](http://bittorrent.org/beps/bep_0046.html)
  - [2019 2.46% of downstream, and 27.58% of upstream internet traffic](https://onlinelibrary.wiley.com/doi/abs/10.1002/cpe.5723)
- [IPFS](https://docs.ipfs.io/) P2P filesystem, uses content addressing; [Paper](https://raw.githubusercontent.com/ipfs-inactive/papers/master/ipfs-cap2pfs/ipfs-p2p-file-system.pdf)
  - [Mutable File System](https://docs.ipfs.io/concepts/file-systems/#mutable-file-system-mfs) API that takes care of managing content hashes
  - [DNSLink] (https://docs.ipfs.io/concepts/dnslink/#publish-using-a-subdomain) DNS -> IPFS content hash mapping

### 5.3 Capability Systems

- [Tahoe LaFS](https://agoric.com/assets/pdf/papers/tahoe-the-least-authority-filesystem.pdf)
- [Capability Myths Demolished](http://www-users.cselabs.umn.edu/classes/Fall-2019/csci5271/papers/SRL2003-02.pdf)
- [Password Capability System (1986)](https://doi.org/10.1093/comjnl/29.1.1)
- [Password-Capabilites: their evolution from the pwassword-capability system into Walnut and beyond(2001)](https://doi.org/10.1109/ACAC.2001.903370)
- [A capability-based transparent cryptographic file system(2005)](https://ieeexplore.ieee.org/abstract/document/1587522)
  
### 5.4 Key Exchange & Cryptography

- [Secure Deduplication with Converget Encryption](https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=6658753)
  - not applicable for P2P, but noteworthy
- [Sessions: E2EE conversations with minimal metadata leakage](https://arxiv.org/pdf/2002.04609)
  - Modifies Signal protocol for P2P usage
    - [X3DH Key Exchange](https://signal.org/docs/specifications/x3dh/x3dh.pdf) but with friend requests instead of prekey-bundles on central servers
  - Onion Routing Protocol
- [Efficient Uni-directional Proxy-Re-Encryption](https://ink.library.smu.edu.sg/cgi/viewcontent.cgi?article=2315&context=sis_research)

Attribute-Based Encryption allows a user to encrypt data if the user has certain attributes assigned by an authority (usually centralized)
- [Attribute-Based Encryption for Fine-Grained Access Control of Encrypted Data (KP-ABE)](https://dl.acm.org/doi/pdf/10.1145/1180405.1180418)
- [Shorter Decentralized Attribute-Based Encryption via Extended Dual System Groups](https://www.hindawi.com/journals/scn/2017/7323158/)
- [Decentralizing Attribute-Based Encryption](https://link.springer.com/chapter/10.1007/978-3-642-20465-4_31)

Predicate Encryption (pretty new and mostly theoretical...)
- [Practical Predicate Encryption for Inner Product](https://eprint.iacr.org/2020/270.pdf)
- [Subset Predicate Encryption and its Applications](https://publik.tuwien.ac.at/files/publik_268469.pdf)

### 5.5 Access Control for Distributed/Cloud Environments

- [Cryptographic Access Control in a Distributed Filesystem (2003)](https://dl.acm.org/doi/pdf/10.1145/775412.775432)
  - Early appraoch of replacing traditional AC systems with cryptography. 
  - Encrypted on the server side, decrypted on the client - Download allowed for everyone, only readable when the encryption key is known.
  - Based on a log-structured filesystem for ensuring integrity and availability.
- [CloudHKA](https://link.springer.com/chapter/10.1007/978-3-642-38980-1_3)
  - Hierachical (Bell-LaPadula basesd) system that heavily uses Proxy-Re-Encryption
  - Computationally intensive key derivation operations can be outsourced to cloud provider whithout compromising security.
- [Hierachical Access Control in Distributed Environments](https://ieeexplore.ieee.org/abstract/document/936308)
- [A Data Outsourcing Architecture Combining Cryptography and Access Control](https://dl.acm.org/doi/pdf/10.1145/1314466.1314477)
  - Uses a graph for key derivation (key derived from secrets of users)
  - Targets distributed DBs
- [Privacy Enhanced Access Control for Outsourced Data Sharing](https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.455.3874&rep=rep1&type=pdf)
  - Two levels of access control: Coarse (for downloading larger blocks, applied by the cloud provider) and fine grained per file
  - ACLs per file and user, graph used to derive encryption keys given the ACL of the file (same ACL means same encryption key for two individual files)
- [An Efficient Key-Management Scheme for Hierarchical Access Control in E-Medicine System](https://link.springer.com/article/10.1007%2Fs10916-011-9700-7)
  - hierachical access control that utilizes key derivation for managing file encryption
- [Achieving Secure, Scalable, and Fine-grained Data Access Control in Cloud Computing](https://ieeexplore.ieee.org/abstract/document/5462174)
- [Decentralized Access Control in Distributed File Systems (2008)](https://dl.acm.org/doi/pdf/10.1145/1380584.1380588)
  - Survey over access control mechanisms and distributed file systems
  - Rather outdated, but very relevant!
- [Decentralized Access Control with Anonymous Authentication of Data Stored in Clouds](https://ieeexplore.ieee.org/document/6463404)
  - AC using ABE techniques in the cloud
  - Good explanations of the basics (ABE, revocation, etc) but not directly applicable for P2P

### 5.6 Blockchain based Papers on AC
- [BlendCAC: A Smart Contract Enabled Decentralized Capability-Based Access Control Mechanism for the IoT ](https://www.mdpi.com/2073-431X/7/3/39/pdf)
- [Privacy aware decentralized access control system](https://www.sciencedirect.com/science/article/pii/S0167739X18332308)
- [Blockchain-Based, Decentralized Access Control for IPFS](https://www.researchgate.net/profile/Wazen_Shbair/publication/327034734_Blockchain-Based_Decentralized_Access_Control_for_IPFS/links/5b9d7375299bf13e60343df2/Blockchain-Based-Decentralized-Access-Control-for-IPFS.pdf)

### 5.7 Other Relevant Papers

- [Tresorit](https://tresorit.com/tresoritwhitepaper.pdf)
- [Local-First Software](https://storage.googleapis.com/jellyposter-store/16620200e730651d20d1a25d315508c7.pdf)
- [POST Cooperative Messaging System](https://www.researchgate.net/profile/Xavier_Bonnaire/publication/221150810_POST_A_Secure_Resilient_Cooperative_Messaging_System/links/09e4150b7d21c4d641000000/POST-A-Secure-Resilient-Cooperative-Messaging-System.pdf)
  - Conceptually based on IVY
  - P2P Notification "Service" for sending content-hashes and encryption keys
- [Kademlia DHT](http://people.cs.aau.dk/~bnielsen/DSE07/papers/kademlia.pdf)
- [Conflict-free Replicated Data Types](https://hal.inria.fr/inria-00609399/document)

## 6. Broader Spectrum

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
- [Textile Threads](https://docs.textile.io/threads/)
  - IPFS- and Ethereum-based distributed Multi-Party-DB with access control, event sourcing
  - [Paper](https://docsend.com/view/gu3ywqi)
- [Peergos P2P E2EE Storage](https://peergos.org/)
  - Based on IPFS
  - Access control data structure [Cryptree](https://book.peergos.org/security/cryptree.html)
    - Tree of symmetric keys to control read access
    - Second tree containing signing key pairs controls write permissions
- Twitter's Project BlueSky
  - [Summary of the modern P2P Ecosystems](https://matrix.org/_matrix/media/r0/download/twitter.modular.im/981b258141aa0b197804127cd2f7d298757bad20)
- [GUN P2P Graph DB](https://gun.eco/)
