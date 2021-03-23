# Multiwriter CRDT

With an offline-first cooperative application it is always possible to cause conflicting writes. Conflict Free Replicated Datatypes (CRDTs) allow to resolve such conflicts automatically.
This structure represents a filesystem-like view on a graph, meaning it forms a tree.
This concept sketches a CRDT for a [Collaboration Space](https://github.com/fsteff/certacrypt/blob/master/docs/multiwriter.md), which at its root has an Access Control List (ACL) that defines a list of writers. Each writer has a root vertice that refers only to the data it has written, which is a subset of the space's graph.

![CRDT Sketch](https://raw.githubusercontent.com/fsteff/certacrypt/master/docs/crdt.png)

## Vector Clock

For tracking the partial order of events and causality violations, a [vector-clock](https://en.wikipedia.org/wiki/Vector_clock) based approach is used. As source for the clock the Hyperobjects transaction ID is used, which itself is the transaction marker index in the append-only-log.
This means the clocks of the writers are not synchronized at all and do not encode any order between each other.

This vector clock is stored with each edge and defines the state of the vector clock when this edge was written.
When a vertex is created, updated or deleted, all vertices *up* to the root vertex are updated to store the latest transaction ID to their edges. This assures that changes *lower* down the tree don't get lost if an other writer makes a concurrent change to one of the vertices on that path.
**TODO:** define how conflicts are detected (concurrent clocks).

## Conflict Resolution

If there are concurrent writes that cannot be resolved using the causual order, there are two fallback strategies:

- The transaction's timestamp (means trusting the writer's CPU clock)
- The order in which the writers are written to the vector clock defines a priority as a last fallback if even the timestamps are equal.
