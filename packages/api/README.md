# `@actual-app/api`

Programmatic access to this fork's budget engine: accounts, transactions,
budgets, imports, schedules, rules, ActualQL queries, and sync.
This is a JavaScript library with local budget storage, not a general HTTP
API exposed by the sync server.

## Build and Use This Fork

Run from the repository root:

```sh
yarn build:api
```

The Node bundle is `packages/api/dist/index.js`; the browser bundle is
`packages/api/dist/browser.js`, with its inline backend worker. Declaration
files are emitted into `packages/api/@types`. Package exports choose the
Node or browser implementation. Installing a published npm package does not
install this checkout's changes; use the local build for this fork.

For a Node script run from the repository root, the following reads accounts
from a budget on your local server. Set `ACTUAL_PASSWORD` and `ACTUAL_SYNC_ID`
first; the Sync ID appears under **Settings → Advanced** in the web app.

```js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const api = require('./packages/api/dist/index.js');

async function main() {
  const dataDir = path.join(os.homedir(), '.actual-api', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  await api.init({
    dataDir,
    serverURL: 'http://localhost:5006',
    password: process.env.ACTUAL_PASSWORD,
  });
  try {
    await api.downloadBudget(process.env.ACTUAL_SYNC_ID, {
      password: process.env.ACTUAL_ENCRYPTION_PASSWORD,
    });
    console.log(await api.getAccounts());
  } finally {
    await api.shutdown();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
```

Keep the API data directory separate from the sync server's data directory.
Use synthetic budgets for tests.

## Initialization and Lifecycle

- Use `serverURL` with either `password` or `sessionToken`. A supplied session
  token is validated; the personal server rejects non-owner identities.
- `init({ dataDir })` also supports local use without a server.
  `loadBudget(id)` opens a local budget; `downloadBudget(syncId)` loads or
  downloads a synced budget. These IDs are different.
- The `password` option to `downloadBudget` is the budget's end-to-end
  encryption password, separate from the server login password.
- Call `sync()` when you need to observe synchronization failures. `shutdown()`
  attempts a final sync but catches its errors, closes the budget, and signs
  out sessions created through password login. Caller-supplied tokens remain
  valid.
- Browser `dataDir` names a virtual directory in browser storage, not a host
  filesystem path. The browser entry manages one worker per initialized API
  instance and requires `shutdown()` before another `init()`.

[methods.ts](methods.ts) defines the public methods, [models.ts](models.ts)
exports entity types, and [app/query.ts](app/query.ts) provides the ActualQL
query builder. Monetary API amounts use integer hundredths of a currency unit.

## TypeScript and Checks

Use `moduleResolution: "bundler"`, `"nodenext"`, or `"node16"` so TypeScript
respects conditional package exports. Legacy `"node"` / `"node10"` /
`"classic"` resolution is not supported by the strict declaration checks.

```sh
yarn workspace @actual-app/api test
yarn workspace @actual-app/api typecheck
```

Browser API tests live in [e2e](e2e) and use
[playwright.config.ts](playwright.config.ts). They require locally available
Playwright browsers. See the [CLI guide](../cli/README.md) for a command-line
wrapper around this library.
