# FAQ

*Can a file protected by CertaCrypt be replicated to peers that do not have read permissions?*
Yes, that is one main requirement for CertaCrypt. This way data can even be stored at untrustworthy cloud providers while still guaranteeing the confidentiality of the data.

*Does CertaCrypt protect anonymity?*
TLDR: Not really.
For CertaCrypt the same anonymity characteristics apply as with hyperdrive. Unless an anonymization service such as a VPN is used, peers are able to see the IP address of all other peers. Also, even if an adversary has no read permissions to the files, if this adversary knows the public key of the hyperdrive, it is able to see *that* changes to individual files are made. If this adversary is online while the writes happen, it might also be able to deduce the IP adress of the owner and *when* changes to files are made.

*Why not just use existing tools, such as PGP or cryptographic file systems on top of hyperdrive?*
Of course that might work as well, but is comes with a certain overhead and limits flexibility. Also, this is no subsitution of CertaCrypt's key managment. CertaCrypt deeply integrates into hyperdrive and even encrypts the metadata itself. Files protected by CertaCrypt are hidden from normal hyperdrive clients, while ensuring compatibility for public (unencrypted) files.
Furthermore, most cryptograpic file systems do not hide file metadata and directory structure. [CryFS](https://www.cryfs.org/comparison/#Summary) gives a great comparison of various systems and shows their limitations.

*What makes it different from ordinary distributed file systems with encryption?*
The fact that hyperdrive works completely P2P changes the requirements regarding security. While typically distributed systems are under control of its operator, in P2P software you always have to assume a peer to be malicious. Only if a peer (e.g. cryptographically) proves its authenticity *some* assumptions about its benignity can be made.
Another difference is that CertaCrypt aims to support and enable [local-first sofware](https://www.inkandswitch.com/local-first.html).
Some approaches used for *ordinary* distributed file systems can be applied there, but in order to function properly a lot of these algorithms require all members of the distributed system to be able to communicate with each other.
