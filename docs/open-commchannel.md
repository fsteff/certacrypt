# Open Communication Channels

*use of that feature is not decided yet(!)*

An Open Communication Channel works similar to a [Private Communication Channel](https://github.com/fsteff/certacrypt/blob/master/docs/private-commchannel.md), but with a mechanism that allows every participant to add others.

Such a channel has a randomly generated ID that then serves as a [HyperPubSub](https://github.com/fsteff/hyperpubsub) topic. A new participant can then announce its (newly created) root vertice as part of the communication channel to the others.

In order to counteract spam and malious-, disrupting- or protocol-violating behaviour, there have to be special mechanisms. These can be partially automated but also need to be influenced by user input (such as report-spam button).
