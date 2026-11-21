# Personal Fork Maintenance

This fork runs Actual as a personal web app with a sync server. Financial
features, browser storage, device sync, the API, and the CLI remain supported.
Native desktop/mobile apps, the documentation site, Storybook, plugin
scaffolding, tours, news feeds, and budget sharing are removed.

## Local Checks

Run commands from the repository root:

```sh
yarn install --immutable
yarn lint
yarn typecheck
yarn test
yarn build:server
E2E_USE_BUILD=1 yarn e2e
```

Use `YARN_ENABLE_NETWORK=0` with an existing dependency cache for offline
installs. Builds never fetch translations or contact a source repository.
Optional translation JSON files belong in `packages/desktop-client/locale/`;
copy a reviewed local snapshot there before building. English is built in.
Record the translation source revision alongside any imported snapshot.

Screenshots must be generated in the Playwright Docker image matching the
version in `packages/desktop-client/package.json`. Run the affected functional
tests first. Scope screenshot updates to affected files and test names, then
rerun those tests without updating snapshots.

## Deployment

`sync-server.Dockerfile` builds the browser app and server together.
`docker-compose.yml` builds the local `actual-personal:local` image and stores
server data in the `actual-data` volume. Nothing publishes an image or deploys
automatically.

```sh
docker compose build
docker compose up -d
```

The example binds port 5006 to loopback. Put an HTTPS reverse proxy in front
of it for access from other devices. Browser storage requires a secure origin
and the server's cross-origin isolation headers. Preserve those headers at
the proxy. Run the same fork version across devices.

Keep the existing server data volume when upgrading. First test a copy of the
server data and an exported budget in a separate instance. Check account
balances, transfers, imports, schedules, bank sync, reconciliation, and reports.
Use two browser profiles to check device synchronization and offline edits.

## Personal Authentication

Password, trusted-header, and OpenID authentication remain supported. OpenID
admits the initial owner and rejects additional identities. Existing sessions
and API keys belonging to non-owner identities are rejected. Sharing and user
administration endpoints are removed.

Existing database migrations and legacy ownership records remain intact.
For an existing OpenID installation, use the identity already marked as its
owner. Existing collaborator accounts cannot sign in to this fork. API keys
remain restricted to their granted budgets.

## Backup and Restore

Export budgets from Settings. Back up the complete server data volume while
the server is stopped, including its account database, encryption metadata,
and budget files. Keep a copy outside the deployment host.

To restore, stop the instance and restore the full data snapshot into its
volume, then start the matching application version. Verify balances and
device sync before resuming normal use. An older container alone does not
undo database migrations; keep the matching data snapshot for rollback.

## Selective Upstream Imports

Cleanup baseline: `31ae481fd`, based on upstream `290c6da62`.

Do not contact GitHub or change remote services from this checkout. Review
changes supplied locally as patches or Git bundles. Import focused fixes with
their dependencies and tests. Preserve package names and paths to reduce
conflicts. Record each imported revision in the local commit history.

After an import, check that removed platforms, sharing, community links,
news polling, and release automation have not returned. Run the local checks
and the relevant financial workflow tests before deploying manually.
