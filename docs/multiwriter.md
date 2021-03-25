# Concept for giving Write Access

To rule out a large number of edge cases, write access uses a rather simplified concept of *Collaboration-Spaces*.

*Here, a directory in terms of graph theory is a vertex and all its edges*

A space typically is is a directory, but technically works independently of it.
Multiple spaces can intersect, but write permissions in one do not automatically give write permissions in the other - even if the directory structure would suggest that.
A space is owned by one user and its definition can only be modified by that user.

It is implemented using an Access-Control-List (ACL) composed of:

- a root vertice (or a number of it)
- included directories (array of path specifications - allow wildcards?)
- shared directories that are merged into the root vertice (root vertice id : shared vertice id pairs)
  - in case of revokation, the referenced vertex can either be removed (which removes all of the files of the user)
   or the vertex is pinned to a certain version
- optionally a view merging strategy

Spaces create a merged directory view - if there are multiple intersecting spaces, that happens independently of each other!
To create such a view various strategies are possible, the simplest one (and therefore initiall implemented) is only using timestamps (last-write-wins).
[Multiwriter CRDT](https://github.com/fsteff/certacrypt/blob/master/docs/crdt.md) is a concept on how a more sophisticated CRDT tailored for filesystems could look like.

To allow one user deleting an other user's file or directory, *thombstones* are created. These are special vertices that define that a file should not be included in the view, unless there is a newer version of it than the *thombstone*.

For more fine-grained access control, *sub-spaces* can be created. These define additional rules as a subset of the parent space. These subspaces inherit its parent's properties and can define additional shared directories.

In case of intersecting spaces, an additional space *should* be defined (automatically?), which inherits from both spaces. These are called *inter-spaces* and can define their own behaviour. This allows for both parent spaces to have the same view of the data.

*TODO: how to handle inter-spaces of different users*

## Technical Details

A space definition is a graph vertex containing the ACL. These can then be referenced like directories, but act as referrer-nodes.

There are two possible ways to archive that on the graph-layer (likely both are implemented):

1. directly referencing to files and directories in the graph
   - can be archieved by requesting write permissions - these requests then contain the directory
2. using pre-shared referrer nodes
    - allows instant and asynchronous permission management
    - each user shares referrer nodes in advance
    - when the access permissions are granted the user defines the label at the referrer node and the encryption key to encrypt the shared directory node
    ![preshared-node drawing](https://raw.githubusercontent.com/fsteff/certacrypt/master/docs/writeaccess-preshared-node.png)