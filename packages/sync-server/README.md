# Actual Personal Sync Server

`@actual-app/sync-server` serves the built web app, persists synced budget
files, and hosts authentication and bank-connection endpoints. Budget
calculations and editing run in the browser or API process. This fork admits
the owner, preserves device sync and budget-scoped API keys, and removes
sharing and user administration.

## Run from This Checkout

Use the Node version pinned in [../../.nvmrc](../../.nvmrc). The sync-server
manifest requires Node.js >=22.19.0. Run Yarn from the repository root.

```sh
# Browser and local sync server for development
yarn start:server-dev
```

The sync server listens on port 5006 and proxies browser routes to Vite on
port 3001. For the production browser bundle:

```sh
yarn build:server
NODE_ENV=production yarn start:server
```

`start:server` rebuilds the server before starting it. To run an existing
build directly:

```sh
NODE_ENV=production node packages/sync-server/build/app.js
```

Installing a published `@actual-app/sync-server` package or using an upstream
container image does not include this checkout's changes. Use the root
[docker-compose.yml](../../docker-compose.yml) and
[sync-server.Dockerfile](../../sync-server.Dockerfile) for this fork. The
package-local Compose file and `docker/` recipes are legacy upstream packaging
artifacts; they are not the maintained personal-fork deployment path.

## Configuration and Data Paths

[load-config.js](src/load-config.js) defines the accepted configuration keys,
environment variables, and defaults. `ACTUAL_CONFIG_PATH` selects a JSON file;
otherwise the loader tries the package/project root's `config.json`, then the
default data directory. Environment variables override file settings.

| Environment variable                    | Purpose / default                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `ACTUAL_DATA_DIR`                       | Base for storage; otherwise `/data` when it exists, then the server project root          |
| `ACTUAL_SERVER_FILES`                   | Account database and migration state; defaults to `server-files` under the base directory |
| `ACTUAL_USER_FILES`                     | Synced budget files; defaults to `user-files` under the base directory                    |
| `ACTUAL_PORT`                           | Listen port; falls back to `PORT`, then 5006                                              |
| `ACTUAL_HOSTNAME`                       | Listen address; defaults to `::`                                                          |
| `ACTUAL_WEB_ROOT`                       | Built browser assets; defaults to the installed web workspace's `build` directory         |
| `ACTUAL_LOGIN_METHOD`                   | `password`, `header`, or `openid`; defaults to `password`                                 |
| `ACTUAL_HTTPS_KEY`, `ACTUAL_HTTPS_CERT` | Optional TLS key/certificate paths or PEM content                                         |

Set `ACTUAL_DATA_DIR` before startup to relocate the default subdirectories.
Changing only `dataDir` in JSON does not recompute their defaults when running
`build/app.js`; set `serverFiles` and `userFiles` explicitly in that case.
The CLI launcher below handles a JSON `dataDir` before loading server config.

The root Compose service uses `/data` and a persistent named volume, with host
port `127.0.0.1:5006`. See [maintenance](../../MAINTENANCE.md) for HTTPS proxy,
backup, and restore procedures. There is no automatic publishing or deployment.

## Authentication

Password authentication is the default. Header authentication validates
`x-actual-password` as the server password and requires a trusted auth proxy;
it does not create users from arbitrary identity headers. OpenID accepts the
initial identity when no named users exist, then only the existing enabled
owner. Existing non-owner sessions and API keys are rejected, and old sharing
grants no longer grant access. `ACTUAL_USER_CREATION_MODE` is accepted for
legacy configuration compatibility but does not enable additional users.

OpenID settings are under `openId` in the configuration schema. The client
secret can be supplied through `ACTUAL_OPENID_CLIENT_SECRET_FILE`. Legacy
GitHub-token and CORS-proxy configuration fields also remain accepted; they
do not restore the removed plugin service. CORS proxying is disabled by
`corsProxy.enabled: false` by default.

## Server CLI and Local Diagnostics

Build first, then run the local launcher from the repository root:

```sh
node packages/sync-server/build/bin/actual-server.js --help
node packages/sync-server/build/bin/actual-server.js --version
node packages/sync-server/build/bin/actual-server.js --config /absolute/path/config.json
```

Options are `--help` / `-h`, `--version` / `-v`, `--config <path>`, and
`--reset-password`. Unlike `build/app.js`, this launcher defaults its data
base to `./data` when present, otherwise the current directory. An explicit
`ACTUAL_DATA_DIR` takes precedence. Always select the intended data directory
before running a password reset.

`GET /health` returns `{ "status": "UP" }`. To check a locally running server
with the same configuration:

```sh
node packages/sync-server/build/scripts/health-check.js
```

```sh
yarn workspace @actual-app/sync-server test
yarn workspace @actual-app/sync-server typecheck
```

Tests use temporary/synthetic data. GoCardless adapter development is described
in [src/app-gocardless/README.md](src/app-gocardless/README.md).
