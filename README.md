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

Requires Node.js 22.18 or later, Python 3, a C/C++ build toolchain, and the Yarn
version checked into this repo.
Run commands from the repository root.

```sh
yarn install --immutable
yarn start:server-dev
```

For a browser-only development session, use `yarn start`. Choose **Try the demo**
to try the app with sample data. For a production build:

```sh
yarn build:server
yarn start:server
```

## Self-Host

```sh
docker compose build
docker compose up -d
```

The server listens on local port 5006 and persists data in the `actual-data`
Docker volume. Configure HTTPS through your reverse proxy for other devices.
See [MAINTENANCE.md](MAINTENANCE.md) for deployment, authentication, backups,
restore, testing, and selective upstream imports.

## Development

```sh
yarn lint
yarn typecheck
yarn test
E2E_USE_BUILD=1 yarn e2e
```

Builds use local translation files and never download source repositories.
All publishing and deployment are manual. GitHub and remote service operations
are outside this checkout's workflow.

## License

Actual Budget is MIT licensed. Original copyright and license notices remain
in [LICENSE.txt](LICENSE.txt).
