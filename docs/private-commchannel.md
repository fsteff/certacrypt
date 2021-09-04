# Private Communication Channels

Technically, private communication channels sketched as [Collaboration Spaces](https://github.com/fsteff/certacrypt/blob/master/docs/multiwriter.md) with a custom view merging strategy.
*But for now they are implemented as simple persited graph vertices(!)*

Communication channels exist between each friend user, but can also be application-defined and have an arbitrary number of participants.

Communication Channels are shared and instantiated using [Inbox](https://github.com/fsteff/certacrypt/blob/master/docs/inbox.md) envelopes.

Applications can add sub-graphs to the communication channels.
The structure of such a communication sub-graph is not defined, but typically each feature or application would get its own sub-graph in order to ensure these do not interfer. Features with frequent messages need a strategy to maintain efficiency, such as creating a structure that encodes temporal ordering.

 ![social sketch](https://raw.githubusercontent.com/fsteff/certacrypt/master/docs/social.png)
