# Working on This Personal Actual Fork

## Scope

This is a personal, self-hosted web app. Keep financial tools, on/off-budget
accounts, imports, bank sync, schedules, rules, reports, browser offline storage,
device sync, the API, and the CLI. Desktop/mobile native packages, collaboration,
community automation, tours, news, and plugin scaffolding are intentionally absent.

Do not contact GitHub or change remote services. Do not fetch, push, publish,
open pull requests, or deploy. Use local patches or Git bundles for selected
upstream changes. Never use real financial data in tests.

## Commands

Run every Yarn command from the repository root:

- `yarn start`: browser development server, port 3001.
- `yarn start:server-dev`: browser plus local sync server, port 5006.
- `yarn build:server`: production browser and server build.
- `yarn build:api` and `yarn build:cli`: retained integration packages.
- `yarn lint`, `yarn typecheck`, `yarn test`: required checks.
- `E2E_USE_BUILD=1 yarn e2e`: browser tests using the production build.
- `YARN_ENABLE_NETWORK=0 yarn install --immutable`: install from local cache.

Builds consume local translation files; never add implicit repository downloads.
Use the demo budget for browser checks. Test device sync against a temporary
local server. Keep production data volumes separate from test data.

## Code

Use TypeScript and existing types. New files must be strict; do not add
`@ts-strict-ignore` or lint suppressions. Prefer functions and existing patterns.
React Compiler handles ordinary memoization. Keep components in separate files.
Use translated strings and `Trans` for user-facing text. Use `FinancialText`
or tabular-number styles for money. Preserve accessibility and mobile browsers.

Use conditional package exports for browser and Node/API implementations.
Preserve financial calculations, database migrations, encryption, authorization,
and sync semantics when removing unrelated features. Generated icons and build
output are not source files to edit manually.

## Checks and Changes

Keep changes focused. Add meaningful regression coverage for changed behavior.
Run types, lint, relevant tests, and affected builds. Do not skip commit hooks.
Use typed branch names such as `chore/`, `fix/`, or `feat/`; use `[AI]` for commits.
Keep auxiliary worktrees outside this repository, under `~/DynerFolder/`.

VRT snapshots must be generated in the pinned Linux Playwright Docker image.
Run functional tests first; scope updates to affected files and test names and
verify again without updates. Never regenerate all snapshots speculatively or
request remote screenshot generation.

See MAINTENANCE.md for deployment, backups, recovery, and local upstream imports.
