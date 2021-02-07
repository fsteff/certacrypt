# Collection of Ideas for Communication

## Version 1 - part of the graph

- each message is a graph node
- each feature has its own branch
  - apps might want to also create their own branches
- *should* not be modified (disable at all? => edge version pinning)
- unified protobuf schema (extensible)
- in the future, when there are multiple devices we can use a CRDT to combine that

\+ very powerful

\- way more complex
\- overhead

## Version 2 - seaparate hypercore

\+ more efficient

\- less powerful
\- additional difficulties with discovery
\- for multiple devices this would require a more complex solution
