# Multiwriter CRDT

With an offline-first cooperative application it is always possible to cause conflicting writes. Conflict Free Replicated Datatypes (CRDTs) allow to resolve such conflicts automatically.
This structure represents a filesystem-like view on a graph, meaning it forms a tree.
This concept sketches a CRDT for a [Collaboration Space](https://github.com/fsteff/certacrypt/blob/master/docs/multiwriter.md), which at its root has an Access Control List (ACL) that defines a list of writers. Each writer has a root vertice that refers only to the data it has written, which is a subset of the space's graph.

## Vector Clock

For tracking the partial order of events and causality violations, a [vector-clock](https://en.wikipedia.org/wiki/Vector_clock) based approach is used. As source for the clock the Hyperobjects transaction ID is used, which itself is the transaction marker index in the append-only-log.
This means the clocks of the writers are not synchronized at all and do not encode any order between each other.

This vector clock is stored with each edge and defines the state of the vector clock when this edge was written.
When a vertex is created, updated or deleted, all vertices *up* to the root vertex are updated to store the latest transaction ID to their edges. This assures that changes *lower* down the tree don't get lost if an other writer makes a concurrent change to one of the vertices on that path.

The following example visualizes how concurrent changes are merged and conflicts are detected:
Let there be a set of 3 writers (A,B,C) that start with transaction ID 1.
Each starts with a single root vertex for the merged space. The root vertex of A has an edge to B and C labeled as '.', meaning these are to be merged.
Then the following changes are made:

 - C adds a vertex with content 'C.B' and then an edge labeled 'b'. The vector clock written to the edge therefore is (1,1,2).
 - C adds a vertex with content 'C.A' and then an edge labeled 'a'. The vector clock written to that edge is (1,1,3).
 - The changes are synchronized to A and B.
   - The shared view is now consistent between A,B and C.
 - A adds a vertex with content 'A.A' and then and edge labeled 'a'. The vector clock written to that edge is (2,1,3).
 - A synchronizes its changes with C. Since the update by A happened after the one by C it is clear that the vertex with 'C.A' is overwritten by the one with 'A.A'.
 - B adds a thombstone and labels it 'a'. The vector clock written to that edge is (1,2,3)
 - A creates a vertex 'A.A.N'. It adds an edge from 'A.A' to 'A.A.N' and labels it 'n' and updates all edges *up* to the root vertex. The vector clock at both edges is (3,1,3).
 - A and B synchronize their changes with C. Since both changed the edge labeled 'a' the two vector clocks show a lower value for each other: (3,1,3) vs (2,2,3) (!). Therefore a conflict is detected that has to be resolved using a  set of rules that ensures determinism.
   - The rules state that deletes have a lower priority than updates, the changes of A outweigh the ones of C.

![CRDT Sketch](https://raw.githubusercontent.com/fsteff/certacrypt/master/docs/crdt.png)

## Conflict Resolution

If there are concurrent writes that cannot be resolved using the causual order, there are three fallback strategies:

- New and updated edges have a higher priority than ones that point to a tombstone.
- Comparison of the transaction's timestamp (means trusting the writer's CPU clock)
- The order in which the writers are written to the vector clock defines a priority as a last fallback if even the timestamps are equal.
