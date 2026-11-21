# Client Connection

This module connects the browser UI to its local budget backend. It does not
connect directly to the remote sync server or manage budget sharing.

The browser implementation in [index.ts](index.ts) queues requests until the
worker/channel handshake completes, matches replies by request ID, and
notifies listeners of pushed events. Public handler and event types come
from [handlers.ts](../../../types/handlers.ts) and
[server-events.ts](../../../types/server-events.ts).

For Node/API consumers, the `api` export condition selects
[index.api.ts](index.api.ts). Its `send` calls the local core handler through
`lib.send`, without a worker or browser event subscriptions. Conditional
exports in [package.json](../../../../package.json) select the implementation;
consumers should import the public subpath rather than a platform file.

The counterpart is [server/connection](../../server/connection/README.md).
Multi-tab coordination lives separately in
[browser-server/coordinator.ts](../browser-server/coordinator.ts).
