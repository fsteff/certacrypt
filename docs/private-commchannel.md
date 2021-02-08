# Private Communication Channels

Technically, private communication channels are [Collaboration Spaces](https://github.com/fsteff/certacrypt/blob/master/docs/multiwriter.md) with a custom view merging strategy.

Communication channels exist between each friend user, but can also be application-defined and have an arbitrary number of participants.

Similar to *normal* Collaboration Spaces, Communication Channels are initiated using [Pre-Shared Vertices](https://github.com/fsteff/certacrypt/blob/master/docs/preshared-vertices.md).

The structure of such a communication sub-graph is not defined, but typically each feature or application would get its own sub-graph in order to ensure these do not interfer. Features with frequent messages need a strategy to maintain efficiency, such as creating a structure that encodes temporal ordering.

*TODO: define view merging strategy*
