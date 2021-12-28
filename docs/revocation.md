# Permission Revocation

Since hypercore writes cannot be undone, revoking permissions only affects future changes.
This means vertices and files only are rewritten with a new encryption key when they are changed (lazy re-encryption).

## Read (Key Rotation)

Revoking read access means that a *share* is set to *revoked*, which means it is no longer updated when the referred vertex is encrypted with a new encryption key.
To make the handling of the lazy re-encryption easier, each time when a file is updated all directories on the path to the root are rewritten with a new encryption key, including the edges of the *shares* (which aren't set to *revoked*). For *Spaces* this is not much overhead, since the directories are rewritten anyway to update their timestamp.

### Referrer Rotation

Rotating encryption keys is not that easy for vertices that are referred though a pre-shared vertex. Since the change of encryption keys has to be communicated and everything has to work asynchronously (offline), multiple keys have to be supported simultaneously.
This is implemented by adding new edges to the *Space* vertex each time a parent *share* is revoked. This means there can be multiple edges to the same PSV but with different refferrer-keys at once, each annotated with a version number. A client reading/queriying those has to find out the matching one using a trial-and-error strategy.
When the writer of the PSV detects that, it automatically updates the used key accordingly by re-encrypting the referred vertex. The owner of the *Space* then can delete the old edge(s).

## Write (Version Pinning)

When a write permission is revoked, the transaction is pinned to the current hypercore version (block number of the transaction). This way any additional changes are simply ignored.
