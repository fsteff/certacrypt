# Concept for giving Write Access

To rule out a large number of edge cases, write access uses a rather simplified concept of *Collaboration-Spaces*.

*Here, a directory in terms of graph theory is a vertex and all its edges*

A space typically is is a directory, but technically works independently of it.
Multiple spaces can intersect, but write permissions in one do not automatically give write permissions in the other - even if the directory structure would suggest that.
A space is owned by one user and its definition can only be modified by that user.

It is implemented using an Access-Control-Lists (ACL) appended to the root vertice's edges.
These ACLs define included and excluded directories and usually are restricted to a set of hypercore feeds.

In case of revokation, the referenced vertex can either be removed (which removes all of the files of the user) or the vertex is pinned to a certain version.

Spaces create a merged directory view - if there are multiple intersecting spaces, that happens independently of each other!
To create such a view various strategies are possible, the simplest one (and therefore initiall implemented) is only using timestamps (last-write-wins).
[Multiwriter CRDT](https://github.com/fsteff/certacrypt/blob/master/docs/crdt.md) is a concept on how a more sophisticated CRDT tailored for filesystems could look like.

To allow one user deleting an other user's file or directory, *thombstones* are created. These are special vertices that define that a file should not be included in the view, unless there is a newer version of it than the *thombstone*.

For more fine-grained access control, *sub-spaces* can be created. These define additional rules as a subset of the parent space. These subspaces inherit its parent's properties and can define additional shared directories.

In case of intersecting spaces, an additional space *should* be defined (automatically?), which inherits from both spaces. These are called *inter-spaces* and can define their own behaviour. This allows for both parent spaces to have the same view of the data.

*TODO: how to handle inter-spaces of different users*

## Write Access Set-Up

Collaboration Spaces are implemented as graph views and the write restrictions are implemented on hyper-graphdb query level. When queried *normally*, the root vertex is not part of the results because it only serves as an intermediate referrer for the underlying data structure.

Since only the owner of a hypercore feed can manipulate it, granting write access to parts of a graph is only possible by referring to already existing vertices on an other hypercore feed.
There are two possible ways to archive that on the graph-layer (only the latter is implemented):

1. directly referencing to existing files and directories in the other user's graph
   - can be archieved by requesting write permissions - these requests then contain the directory
2. using [pre-shared vertices](./preshared-vertices.md)
    - allows instant and asynchronous permission management
    - each user supplies pre-shared vertices in advance
    - when granting access the owner of the space specifies the referrer label and encryption key of the first vertex
    ![preshared-node drawing](https://raw.githubusercontent.com/fsteff/certacrypt/master/docs/writeaccess-preshared-node.png)

## Fine-grained Restrictions

For a *typical* (default implementation) Collaboration Space the participants are allowed to create any arbitrary directory structure, but are restricted to the hypercore feed that contains ther pre-shared vertices.

On the hyper-graphdb level this means the edge from the Space's root vertex specifies (whitelists) the allowed hypercore feeds. Additional restrictions can be applied by setting rules (array of path specifications, [fnmatch](https://www.man7.org/linux/man-pages/man3/fnmatch.3.html) style with wildcards such as *, **, ?, [a-z].
Restriction rules are currently implemented using the [minimatch](https://www.npmjs.com/package/minimatch) with the options *nobrace, dot, noext, nocomment*.
Edges *down* the directory tree can define additional restrictions, but cannot add exceptions to previously defined rules.
The path to be tested always starts with the currend feed and then the labels relative to the vertex the rule is appended to:  `<hex feed id>/<path>`, therefor the rules have to count in the feed id as well. This way rules are either feed specific or have to start with a wildcard.

In case of *sub-spaces*, this means these have either to be written by the owner of the space (who does not have any restrictions) or an exception has to be added to the list of rules on the space root's edge.
