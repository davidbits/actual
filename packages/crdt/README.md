# `@actual-app/crdt`

Shared sync primitives for the browser, API, and sync server: timestamps,
Merkle trees, and Protocol Buffers message schemas. Treat this as an internal
workspace and keep protocol changes compatible with retained clients.

Run commands from the repository root:

```sh
yarn workspace @actual-app/crdt test
yarn workspace @actual-app/crdt build
```

## Generated Protocol Types

[src/proto/sync.proto](src/proto/sync.proto) defines the wire messages.
[bin/generate-proto](bin/generate-proto) uses an installed `protoc` executable
and the workspace dependency `@bufbuild/protoc-gen-es` to generate
[src/proto/sync_pb.ts](src/proto/sync_pb.ts), then formats it with Oxfmt:

```sh
yarn workspace @actual-app/crdt proto:generate
```

Supply a reviewed local `protoc` installation on `PATH`; the repository does
not pin or download that compiler. The generator plugin is resolved by
[package.json](package.json) and the root lockfile. The generated file's header
records the plugin version used for its last generation, which may differ
from the currently installed version.

Output is TypeScript using `@bufbuild/protobuf`, not the old JavaScript
`protoc-gen-js` format. Do not hand-edit generated output or apply the obsolete
`var global` CSP workaround. Review generated changes and run the CRDT and
affected core/server sync tests after changing the schema.
