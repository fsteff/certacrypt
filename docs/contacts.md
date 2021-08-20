# Contacts

Contacts are stored as part of the [App Session](./session.md). For usability the `/contacts` root is a view that has cached shortcuts and aggregates of information, but only the edges to the contact's public user vertices are actually persisted. Starting at the [Inbox](./inbox.md) the communication channels store the shares and reference to application data.

## Friends

To counteract spam and other malicious activities, initial contact messages must only be written to the inbox after the user accepts that.
Once both users communicate with each other over their inbox these are called friends.