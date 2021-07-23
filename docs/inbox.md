# Concept for the Inbox Feature

One main problem of the decentralized nature of this project is that setting up a secure communication channel between two parties is a difficult task. The *Inbox* feature aims to solve that problem by bootstrapping the communication and doing an asynchronous first key exchange.

The main component for this to work is an *envelope*. This is a [libsodium sealed box](https://doc.libsodium.org/public-key_cryptography/sealed_boxes) strapped to an edge **instead** of the encryption key for the referred vertex.
The message in that sealed box then is the encryption key for that vertex.
A libsodium sealed box does contain contain any information about the receipient - the only way of knowing if it is adressed to the session's user is by trying to decrypt it with its private key.

The *Inbox* itself is a public graph vertex that has *envelope* edges. For efficiency reasons when querying the edges these can be filtered to only contain the edges added since the last check.

Typically the referred vertex is the root of a [Communication Channel](https://github.com/fsteff/certacrypt/blob/master/docs/private-commchannel.md), a Share Vertex (giving read access) or a [Space root vertex](https://github.com/fsteff/certacrypt/blob/master/docs/multiwriter.md) (invitation to the space).

There is one main prequesite: both user's clients need to know their public keys and the receipient has to check the sender's *Inbox* for *envelopes* addressed to it.
The whole process can be arranged using the following strategy:

1. User A has to get the public key of user B in order to create an *envelope*. This can happen over multiple channels:
   - being in the same group / collaboration space
   - sending a friend request link over any other channel (which are URLs to one user's *Inbox*)
   - at a later stage probably over CTZN
2. User A modifies a [Collaboration Space](https://github.com/fsteff/certacrypt/blob/master/docs/multiwriter.md) (used as Private Communication Channel) root vertex to refer to the Pre-Shared Vertex using the referrer and encryption key that has been specified in the *envelope*
3. User B can then check if user A has put an *envelope* into its *Inbox*
   - if user B knows of user A, it will periodically query A's *Inbox*
   - A notifies B by sending the *envelope* directly over [HyperPubSub](https://github.com/fsteff/hyperpubsub)
4. User B creates a new vertex as root vertex of its part of the Communication Channel and refers to it as specified in the *envelope*.

![Inbox Sketch](https://raw.githubusercontent.com/fsteff/certacrypt/master/docs/Inbox.png)
