# Drive Concept

A corestore drive is an instance of hyperdrive which is modified to add encryption and decryption functionality of the files and their metadata.
An instance is created relative to a graph vertex, which is representing the drive root.
The value field of a *drive* graph vertex contains a [hyper URL](https://github.com/hypercore-protocol/hypercore-proposals/blob/master/proposals/0002-hyper-url.md) to the resource.

## Private Files

Private files are symmetrically encrypted files in the hyperdrive. They are stored in the hidden `./enc` directory, as listing/accessing encrypted metadata might cause normal hyperdrive clients to crash. That is meant by *partial* backwards-compatibility, because it is not possible to list directories containing encrypted files, which obviously also disables listing in recursive mode.

Just as the graph nodes, hyperdrive files are encrypted using the ChaCha20 stream cipher. ChaCha20 internally uses a 64-bit nonce and a 64-bit counter, so as long as the nonce is unique for that key and the file size does not exceed 2^64 bytes, using that cipher is safe, even if it is typically not recommended (for usability reasons). As hypercore entry indices are unique, these can be used as nonce.

For the metadata [Hypertrie](https://github.com/hypercore-protocol/hypertrie) entries we do not know the hypercore index and therefore cannot use that as nonce. Therefore they have to be encrypted using a randomply generated nonce, which is not safe with ChaCha20. Instead, the XChaCha20 cipher with extended nonce size is used (256 bits instead of 64).
This nonce is prepended to the encrypted metadata ciphertext.

For POSIX compatibility reasons also directories are persisted to the metadata Hypertrie. However, these entries do not contain any information about the directory structure and only need to be accessed when the directory metadata is read.

Files can be addressed by providing the hyperdrive path, a metadata encryption key and a file encryption key, which is passed to the URL as the query parameters `mkey` and `fkey`, encoded as hexadecimal strings.
Example: `hyper://<pubkey>/.enc/<fileid>?mkey=<key>&fkey=<key>`

## Public Files

To archive (at least partial) backwards-compatibility, a file can also contain unencrypted files that are addressed and accessed as with a normal hyperdrive.
These files can, but do not have to, be represented in the graph.
If the directory structure does not match the file structure in the graph that can lead to inconsistencies. Applications should take care of that, but it is not enforced by the API. That can be considered a tradeoff for backwards-compatibility.

## Architecture

By using wrappers for the used Hypercore and Hypertrie instances, write and read operations can be intercepted to inject encryption and decryption. 

Writing to a file results in the following process (reading is similar):
![Architecture Sketch](https://raw.githubusercontent.com/fsteff/certacrypt/master/docs/architecture-write.png)
