# Concept for the Inbox Feature

One main problem of the decentralized nature of this project is that setting up a secure communication channel between two parties is a difficult task. The *Inbox* feature aims to solve that problem by bootstrapping the communication and doing an asynchronous first key exchange.

The main component for this to work is an *envelope*. This is a [libsodium sealed box](https://doc.libsodium.org/public-key_cryptography/sealed_boxes) with an expiration date attached to it.
The message in that sealed box contains data that specifies the label and key to use for the root node of the communication channel.

The *Inbox* is a public graph vertex that then refers to the individual communication channels **without** specifying the secret key used to encrypt the root node of the communication channel. It contains a list of envelopes, which is updated if an *envelope's* expiration date is passed.

There is one main prequesite: both user's clients need to know their public keys and they both have to check each other's feeds for *envelopes* addressed to them.
This can be met using the following strategy:

1. User A has to get the public key of user B in order to create an *envelope*
   this can happen over multiple channels:
   - being in the same group / collaboration channel
   - sending a friend request link over any other channel (which are URLs to one user's *Inbox*)
   - at a later stage probably over CTZN
2. User B can then check if user A has put an *envelope* into his *Inbox*
   - if user B knows of user A, it will periodically query A's *Inbox*
   - A notifies B by sending the *envelope* directly over [HyperPubSub](https://github.com/fsteff/hyperpubsub)


![Inbox Sketch](https://raw.githubusercontent.com/fsteff/certacrypt/master/docs/Inbox.png)