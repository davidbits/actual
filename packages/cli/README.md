# @actual-app/cli

Command-line interface for this personal Actual fork. Query and modify accounts,
transactions, categories, payees, rules, schedules, and budgets through the
retained [API](../api/README.md).

Budget commands require a running [sync server](../sync-server/README.md) and
keep a local cached budget. The CLI does not open an arbitrary standalone
budget file. Help, query-schema listings, and cache status/clear operations
do not connect to a server; cache status/clear still require valid config.

## Build This Fork

```bash
yarn build:cli
node packages/cli/dist/cli.js --help
```

Run commands from the repository root, using the Node version in
[../../.nvmrc](../../.nvmrc). The CLI package declares Node.js >=22, but the
root and server have higher minimums; see the [root README](../../README.md).
Installing the published npm CLI would not include this fork's changes.

The examples below use this Bash/Zsh alias for the local build:

```sh
alias actual="node $(pwd)/packages/cli/dist/cli.js"
```

## Quick Start

```bash
# Set connection details
export ACTUAL_SERVER_URL=http://localhost:5006
export ACTUAL_PASSWORD=your-password
export ACTUAL_SYNC_ID=your-sync-id   # Found in Settings → Advanced → Sync ID

# List your accounts
actual accounts list

# Check a balance
actual accounts balance <account-id>

# View a month's budget
actual budgets month 2026-03
```

## Configuration

Configuration is resolved in this order (highest priority first):

1. **CLI flags** (`--server-url`, `--password`, etc.)
2. **Environment variables**
3. **Config file** (via `cosmiconfig`)
4. **Defaults** (`dataDir` defaults to `~/.actual-cli/data`)

### Environment Variables

| Variable                     | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| `ACTUAL_SERVER_URL`          | URL of the Actual sync server (required)              |
| `ACTUAL_PASSWORD`            | Server password (required unless using token)         |
| `ACTUAL_SESSION_TOKEN`       | Session token (alternative to password)               |
| `ACTUAL_SYNC_ID`             | Budget Sync ID (required for most commands)           |
| `ACTUAL_DATA_DIR`            | Local directory for cached budget data                |
| `ACTUAL_CACHE_TTL`           | Cache TTL in seconds (default: 60)                    |
| `ACTUAL_LOCK_TIMEOUT`        | Budget-dir lock wait timeout in seconds (default: 10) |
| `ACTUAL_NO_LOCK`             | Set to `1` to disable budget-dir locking              |
| `ACTUAL_ENCRYPTION_PASSWORD` | Password for end-to-end encrypted budget files        |

The three secrets — `ACTUAL_PASSWORD`, `ACTUAL_SESSION_TOKEN` and `ACTUAL_ENCRYPTION_PASSWORD` — can be read from a file instead, by adding `_FILE` to the variable name (for example `ACTUAL_PASSWORD_FILE=/run/secrets/actual-password`). `_FILE`-suffixed environment variables take priority over regular ones.

### Config File

The CLI config loader in [src/config.ts](src/config.ts) uses `cosmiconfig` with
global search: it searches from the current directory toward the home
directory, then the global configuration directory.

You can create a config file in any of these formats:

- `.actualrc` (JSON or YAML)
- `.actualrc.json`, `.actualrc.yaml`, `.actualrc.yml`
- `actual.config.json`, `actual.config.yaml`, `actual.config.yml`
- An `"actual"` key in your `package.json`

You can instead store your configuration in the `actual` subdirectory of the global configuration directory (e.g. `~/.config/actual/` on Linux) in any of these formats:

- `config` (JSON or YAML)
- `config.json`
- `config.yaml`
- `config.yml`

Example `.actualrc.json`:

```json
{
  "serverUrl": "http://localhost:5006",
  "syncId": "1cfdbb80-6274-49bf-b0c2-737235a4c81f",
  "cacheTtl": 60,
  "lockTimeout": 10,
  "noLock": false
}
```

Supply authentication separately, for example with `ACTUAL_PASSWORD_FILE` or
`ACTUAL_SESSION_TOKEN_FILE`. Passwords, session tokens, encryption passwords,
and the local budget cache are sensitive. Keep them out of tracked files.
If storing credentials in a local config file, restrict its permissions.

The loader rejects unknown config keys and incorrect value types. `cacheTtl`
and `lockTimeout` must be non-negative integers. Output format, verbosity,
and refresh behavior are CLI flags, not config-file keys.

### Global Flags

| Flag                               | Description                                     |
| ---------------------------------- | ----------------------------------------------- |
| `--server-url <url>`               | Server URL                                      |
| `--password <pw>`                  | Server password                                 |
| `--session-token <token>`          | Session token                                   |
| `--sync-id <id>`                   | Budget Sync ID                                  |
| `--data-dir <path>`                | Data directory                                  |
| `--encryption-password <password>` | Budget encryption password                      |
| `--cache-ttl <seconds>`            | Cache TTL; `0` disables caching (default: 60)   |
| `--refresh`                        | Force a sync on this call, ignoring the cache   |
| `--no-cache`                       | Alias for `--refresh`                           |
| `--lock-timeout <secs>`            | Lock wait timeout (default: 10)                 |
| `--no-lock`                        | Disable budget-dir locking (use with care)      |
| `--format <format>`                | Output format: `json` (default), `table`, `csv` |
| `--verbose`                        | Show informational messages                     |

## Commands

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `accounts`        | Manage accounts                |
| `budgets`         | Manage budgets and allocations |
| `categories`      | Manage categories              |
| `category-groups` | Manage category groups         |
| `transactions`    | Manage transactions            |
| `payees`          | Manage payees                  |
| `tags`            | Manage tags                    |
| `rules`           | Manage transaction rules       |
| `schedules`       | Manage scheduled transactions  |
| `query`           | Run an ActualQL query          |
| `server`          | Server utilities and lookups   |
| `sync`            | Refresh or inspect local cache |

Run `actual <command> --help` for subcommands and options.

### Examples

```bash
# List open accounts as a table; add --include-closed for closed accounts
actual accounts list --format table

# Find an entity ID by name
actual server get-id --type accounts --name "Checking"

# Add a transaction (amount in integer cents: -2500 = -$25.00)
actual transactions add --account <id> \
  --data '[{"date":"2026-03-14","amount":-2500,"payee_name":"Coffee Shop"}]'

# Export transactions to CSV
actual transactions list --account <id> \
  --start 2026-01-01 --end 2026-12-31 --format csv > transactions.csv

# Set budget amount ($500 = 50000 cents)
actual budgets set-amount --month 2026-03 --category <id> --amount 50000

# Run an ActualQL query
actual query run --table transactions \
  --select "date,amount,payee" --filter '{"amount":{"$lt":0}}' --limit 10
```

### Amount Convention

All monetary amounts are **integer cents** when passed as input (flags, JSON):

| CLI Value | Dollar Amount |
| --------- | ------------- |
| `5000`    | $50.00        |
| `-12350`  | -$123.50      |

**Output formatting:** Table and CSV output convert recognized top-level money
fields (`amount`, `balance`, `balance_available`, `balance_current`,
`balance_limit`, `budgeted`, `spent`, `carryover`) to two decimal places.
Arbitrary query aliases and nested objects are not automatically converted.
JSON output preserves raw amounts for programmatic use. See
[src/output.ts](src/output.ts).

### Tips & Common Pitfalls

- **Split transactions:** When summing or counting transactions, filter `"is_parent": false` to avoid double-counting. A split parent holds the total amount, and its children hold the individual parts — including both would count the total twice.

- **Repeated reads:** A longer TTL can skip the pre-command budget sync for
  an unencrypted cached budget. It does not make commands offline; see
  [Caching](#caching). For example:

  ```bash
  actual sync
  actual --cache-ttl 3600 query run ...
  actual --cache-ttl 3600 accounts list
  ```

- **Uncategorized transactions:** `category.name` is `null` for transactions without a category. Account for this when filtering or grouping by category.

- **No date sub-fields in AQL:** `date.month`, `date.year`, etc. are not supported as query fields. To group by month, fetch raw transactions with a date range filter and aggregate locally in a script.

## Caching

The CLI keeps a local budget and cache metadata. Within the TTL (default
`60` seconds), read commands can load an unencrypted cached budget without
the explicit pre-command sync. Expired caches, `--refresh`, writes, and
encrypted budgets take the sync/load path. Writes also explicitly sync after
the change.

This does **not** eliminate network access: API initialization logs in or
validates a token on every connected command, and API shutdown attempts a
final sync even after a cached read. Password-created sessions are signed out
on shutdown. A supplied session token is reused. See
[src/connection.ts](src/connection.ts), [src/cache.ts](src/cache.ts), and the
[API lifecycle](../api/README.md#initialization-and-lifecycle).

- `actual sync` — refresh the cache now.
- `actual sync --status` — show how stale the local cache is.
- `actual sync --clear` — remove cache metadata only; local budget files remain.
  The next connected command calls `downloadBudget`, which may load and sync
  an existing local budget instead of downloading a new copy.
- `--refresh` (or `--no-cache`) — force a sync on a single call.
- `--cache-ttl <seconds>` — override the TTL for a single call (use `0` to disable caching).

### Concurrency

The CLI takes a shared lock for read commands and an exclusive lock for write
commands on the per-budget metadata directory. Reads can overlap; writes wait
for readers and other writers. `--lock-timeout` sets the lock wait budget in
seconds (default `10`); retries are not a precise wall-clock deadline.
`--no-lock` disables this coordination. Use separate data directories for
independent integrations.

## Running Locally (Development)

If you're working on the CLI within the monorepo:

```bash
# 1. Build the CLI
yarn build:cli

# 2. Start a local sync server (in a separate terminal)
yarn start:server-dev

# 3. Open http://localhost:5006 in your browser, create a budget,
#    then find the Sync ID in Settings → Advanced → Sync ID

# 4. Run the CLI directly from the build output
ACTUAL_SERVER_URL=http://localhost:5006 \
ACTUAL_PASSWORD=your-password \
ACTUAL_SYNC_ID=your-sync-id \
node packages/cli/dist/cli.js accounts list

# Or use a shorthand alias for convenience
alias actual-dev="node $(pwd)/packages/cli/dist/cli.js"
actual-dev budgets list
```
