# Concept for the Inbox Feature

One main problem of the decentralized nature of this project is that setting up a secure communication channel between two parties is a difficult task. The *Inbox* feature aims to solve that problem by bootstrapping the communication and doing an asynchronous first key exchange.

The main component for this to work is an *envelope*. This is a [libsodium sealed box](https://doc.libsodium.org/public-key_cryptography/sealed_boxes) with an expiration date attached to it.
The message in that sealed box contains data that specifies the label/referrer and key to use for the root node of the communication channel.

The *Inbox* itself is a public graph vertex that that contains a list of envelopes, which is updated if an *envelope's* expiration date is passed. It is used in combination with [Pre-Shared Vertices](https://github.com/fsteff/certacrypt/blob/master/docs/preshared-vertices.md).

There is one main prequesite: both user's clients need to know their public keys and the receipient has to check the sender's *Inbox* for *envelopes* addressed.
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
