# Budget Backend Connection

This is the counterpart to the [client connection](../../client/connection/README.md).
Here, “server” means the local budget engine, usually in a browser worker.
It is separate from the self-hosted `packages/sync-server` HTTP service.

[index.ts](index.ts) receives requests over the browser channel, runs registered
handlers, replies with results/errors, and pushes typed backend events. The
protocol includes request IDs, undo tags, and mutation flags. Error transport
and serializable messages are covered by the tests beside this module.

With the `api` condition, [index.api.ts](index.api.ts) has no browser channel.
Initialization is a no-op; most push events are ignored, while deferred or
dropped sync messages produce warnings for script users. API requests enter
the handlers in-process through the client API adapter and
[server/main.ts](../../../server/main.ts).

Use conditional imports defined in [package.json](../../../../package.json).
The retained `getNumClients()` returns `1` in both implementations; it is not
a count of synced devices or collaborating users.
