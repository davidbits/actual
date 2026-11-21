# Personal Fork Maintenance

This fork runs Actual as a personal web app with a sync server. Financial
features, browser storage, device sync, the API, and the CLI remain supported.
Native desktop/mobile apps, the documentation site, Storybook, app plugin
scaffolding, tours, news feeds, and budget sharing are removed.

## Local Checks

Run commands from the repository root:

```sh
yarn install --immutable
yarn prepare
yarn lint
yarn typecheck
yarn test
yarn build:server
E2E_USE_BUILD=1 yarn e2e
```

Use Node.js 24.22.1 from [.nvmrc](.nvmrc) and the vendored Yarn 4.17.1.
`yarn prepare` configures the retained pre-commit hook. `.yarnrc.yml` disables
install scripts by default, with explicit exceptions for native dependencies;
do not assume installation enables hooks automatically.

Use `YARN_ENABLE_NETWORK=0` with an existing dependency cache for offline
installs. Builds never fetch translations or contact a source repository.
Optional translation JSON files belong in `packages/desktop-client/locale/`;
copy a reviewed local snapshot there before building. English is built in.
Record the translation source revision alongside any imported snapshot.

Local builds do not imply an entirely offline runtime: bank sync and OpenID
use their configured providers. The theme catalog is bundled, but selecting a
repository theme downloads its CSS and may download font assets from GitHub.
Use built-in themes or local CSS when GitHub access is prohibited. See
[customThemes.ts](packages/desktop-client/src/style/customThemes.ts).

Playwright starts a static server for the production build when
`E2E_USE_BUILD=1`; it can reuse an existing server outside CI, so stop stale dev
servers first. See the [web testing guide](packages/desktop-client/README.md)
for local functional tests and scoped Linux Docker screenshot commands.

## Retained Workspaces

The root workspace glob includes nine packages:

| Directory under `packages/` | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `desktop-client`            | Web UI and mobile browser layouts (`@actual-app/web`)          |
| `loot-core`                 | Budget engine, storage, imports, calculations, and sync        |
| `sync-server`               | Self-hosted HTTP service, authentication, and bank connections |
| `api`                       | Node/browser integration library                               |
| `cli`                       | Command-line integration using the API                         |
| `component-library`         | Shared UI components and themes                                |
| `crdt`                      | Shared sync protocol and data structures                       |
| `eslint-plugin-actual`      | Local lint rules used by Oxlint                                |
| `vite-plugin-peggy`         | Parser build support                                           |

Package paths and names are retained to ease local upstream imports.
The two build/lint plugin packages are unrelated to the removed app plugin
service. Test tools and native SQLite dependencies remain necessary.

## Deployment

[sync-server.Dockerfile](sync-server.Dockerfile) builds the browser app and
server together. The root [docker-compose.yml](docker-compose.yml) builds
`actual-personal:local` and stores data in its `actual-data` named volume,
normally prefixed by the Compose project name. Nothing publishes or deploys
automatically.

```sh
docker compose build
docker compose up -d
```

The example binds port 5006 to loopback. Put an HTTPS reverse proxy in front
of it for access from other devices. Use a secure origin and preserve the
server's cross-origin isolation headers at the proxy. Run the same fork
version across devices.

Package-local Docker recipes under `packages/sync-server/docker/` and its
Compose file are retained upstream packaging artifacts, not the deployment
instructions for this fork. For direct Node operation, use
`NODE_ENV=production` and an explicit `ACTUAL_DATA_DIR`; see
[server configuration](packages/sync-server/README.md).

Keep the existing server data volume when upgrading. First test a copy of the
server data and an exported budget in a separate instance. Check account
balances, transfers, imports, schedules, bank sync, reconciliation, and reports.
Use two browser profiles to check device synchronization and offline edits.
Repository tests must use synthetic/demo data; private upgrade validation
must keep any real budget data outside this checkout and test artifacts.

## Personal Authentication

Password, trusted-header, and OpenID authentication remain supported. Header
authentication checks `x-actual-password` against the server password from a
trusted auth proxy; it is not arbitrary identity-header login. OpenID admits
the initial identity when no named users exist, then only the enabled owner.
Existing sessions and API keys belonging to non-owner identities are rejected.
Sharing and user administration endpoints are removed.

Existing database migrations and legacy ownership records remain intact.
For an existing OpenID installation, use the identity already marked as its
owner. Existing collaborator accounts cannot sign in to this fork. API keys
remain restricted to their granted budgets.

## Backup and Restore

Export budgets from Settings. Back up the complete server data volume while
the server is stopped, including its account database, encryption metadata,
and budget files. Keep a copy outside the deployment host. Browser-only edits
must be synced or exported before relying on a server backup.

To restore, stop the instance and restore the full data snapshot into its
volume, then start the matching application version. Verify balances and
device sync before resuming normal use. An older container alone does not
undo database migrations; keep the matching data snapshot for rollback.

## Selective Upstream Imports

Pre-cleanup base: `31ae481fd`, following upstream commit `290c6da62`.
The personal web cleanup is recorded in local commits `33d212f83` through
`7d119eebf`. Use these commits to understand intentional removals.

Do not contact GitHub or change remote services from this checkout. Review
changes supplied locally as patches or Git bundles. Import focused fixes with
their dependencies and tests. Preserve package names and paths to reduce
conflicts. Record each imported revision in the local commit history.

After an import, check that removed platforms, sharing, community links,
news polling, and release automation have not returned. Run the local checks
and relevant financial workflow tests. Deployment is a separate manual action.

## Documentation Maintenance

The [root README](README.md#documentation) indexes all maintained guides.
Check documentation against local source before importing upstream guidance:

- Commands and versions: root/workspace `package.json`, `.nvmrc`, `.yarnrc.yml`.
- Server defaults and paths: `packages/sync-server/src/load-config.js` and
  `packages/sync-server/bin/actual-server.js` (their default data paths differ).
- CLI behavior: `packages/cli/src/config.ts`, `connection.ts`, `cache.ts`, and
  command implementations; API shutdown can still sync after a cached read.
- Browser tests: `packages/desktop-client/playwright.config.ts` and `e2e/fixtures.ts`.
- Design values: component-library tokens, styles, and theme definitions.
- Migrations/protocol: the core migration tests and CRDT schema/generator.

Design and accessibility goals are review targets, not blanket conformance
claims. Preserve the original [root license](LICENSE.txt) and
[server license](packages/sync-server/LICENSE).
