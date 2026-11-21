# Actual — Personal Web Fork

Personal, self-hosted spending and budget tracking, based on Actual Budget.
Use the browser on desktop or phone, with local storage and synchronization
through your own server.

Accounts on and off budget, transactions, payments, imports, bank sync,
schedules, rules, reconciliation, budgets, reports, themes, the API, and the CLI
remain available. Native app packages, budget sharing, user management, tours,
release news, plugin scaffolding, and upstream contributor infrastructure are
removed.

## Run Locally

Use Node.js 24.22.1, pinned in [.nvmrc](.nvmrc) and the production Dockerfile,
plus Python 3 and a C/C++ build toolchain for native dependencies. The root
manifest declares Node.js >=22.18.0; the sync server requires >=22.19.0.
Yarn 4.17.1 is checked into this repo. Run commands from the repository root.

```sh
yarn install --immutable
yarn prepare
yarn start:server-dev
```

For a browser-only development session, use `yarn start`. Choose **Try the demo**
to try the app with sample data. For a production build:

```sh
yarn build:server
NODE_ENV=production yarn start:server
```

## Self-Host

```sh
docker compose build
docker compose up -d
```

Compose binds the server to `127.0.0.1:5006` and persists data in its
`actual-data` named volume (Docker normally prefixes the name with the Compose
project name). Configure HTTPS through your reverse proxy for other devices.
See [MAINTENANCE.md](MAINTENANCE.md) for deployment, authentication, backups,
restore, testing, and selective upstream imports.

## Development

```sh
yarn lint
yarn typecheck
yarn test
yarn build:browser
E2E_USE_BUILD=1 yarn e2e
```

Builds use local translation files and never download source repositories.
All publishing and deployment are manual. GitHub and remote service operations
are outside this checkout's workflow.

## Documentation

- [Maintenance](MAINTENANCE.md): builds, authentication, backups, recovery, and local upstream imports.
- [Web client](packages/desktop-client/README.md): browser development, functional tests, and Docker screenshot tests.
- [Sync server](packages/sync-server/README.md): server commands, configuration, and data paths.
- [API](packages/api/README.md) and [CLI](packages/cli/README.md): integrations built from this fork.
- [CRDT](packages/crdt/README.md) and [budget migrations](packages/loot-core/migrations/README.md): sync format and database compatibility.
- [Client connection](packages/loot-core/src/platform/client/connection/README.md) and [backend connection](packages/loot-core/src/platform/server/connection/README.md): browser worker and Node/API messaging.
- [GoCardless adapters](packages/sync-server/src/app-gocardless/README.md): bank normalization and local tests.
- [Product](PRODUCT.md), [design](DESIGN.md), and [review guidelines](CODE_REVIEW_GUIDELINES.md): scope and development conventions.
- [Agent instructions](AGENTS.md), [Claude entrypoint](CLAUDE.md), and [VRT skill](.claude/skills/running-vrts/SKILL.md): local agent workflow.

## License

Actual Budget is MIT licensed. Original copyright and license notices remain
in [LICENSE.txt](LICENSE.txt).
