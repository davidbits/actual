# Actual Web Client

`@actual-app/web` is the browser UI, including mobile browser layouts. The
`desktop-client` directory name is retained for compatibility with local
upstream imports; native desktop and mobile apps are absent.

Run every Yarn command from the repository root. See the
[root README](../../README.md) for prerequisites.

## Development and Builds

```sh
yarn start
```

Vite serves the browser app on port 3001. For browser development through the
local sync server on port 5006, use `yarn start:server-dev` instead.
Use **Try the demo** for sample data.

`yarn build:browser` writes `packages/desktop-client/build`. It consumes local
translations from `packages/desktop-client/locale/` when present; English is
built in. `yarn build:server` builds both this bundle and the sync server.

## Functional Browser Tests

```sh
yarn build:browser
E2E_USE_BUILD=1 yarn e2e
```

Playwright starts the local static server itself. Without `E2E_USE_BUILD`,
`yarn e2e` starts the Vite development server. Both default to
`http://localhost:3001`; non-CI runs may reuse an already running server.
Stop an old dev server when checking a freshly built bundle.

To run a selected test:

```sh
E2E_USE_BUILD=1 yarn e2e e2e/transactions.test.ts -g 'filters transactions by date range'
```

Chromium must already be available in Playwright's local browser cache, or run
inside the pinned Playwright image below. `E2E_START_URL` targets an existing
local test server and disables automatic server startup. `E2E_PORT` changes the
production test server's port; the development script fixes its port at 3001.
`E2E_WORKERS` controls worker count. Keep tests on demo data and local servers.

Ordinary functional runs skip `toMatchThemeScreenshots()` assertions. Use
separate temporary server data for device-sync checks; the static browser test
server is not a sync server.

## Visual Regression Tests

Screenshot comparisons and updates use the pinned Linux Playwright Docker
image, `mcr.microsoft.com/playwright:v1.61.1-jammy`, matching
`@playwright/test` in [package.json](package.json) and [bin/run-vrt](../../bin/run-vrt).
Have this image and the dependencies cached locally first. Do not generate
snapshots on the host or request remote screenshot generation.

After the selected functional test passes, run the same test in Docker. This
example starts the built app inside the container; loopback HTTP is sufficient
and no external network is needed:

```sh
docker run --rm --pull=never --network none \
  -v "$(pwd)":/work -w /work \
  -e YARN_ENABLE_NETWORK=0 -e E2E_USE_BUILD=1 \
  mcr.microsoft.com/playwright:v1.61.1-jammy \
  /bin/bash -c "yarn vrt e2e/transactions.test.ts -g 'filters transactions by date range'"
```

For an intended visual change, add `--update-snapshots` to that **scoped** test
command, inspect the changed PNGs, then rerun without the update flag. Never
refresh the whole suite speculatively. Each matcher captures `auto`, `dark`,
and `midnight`; the default `auto` appearance is light unless the test changes
the preferred color scheme. Committed snapshots end in `-chromium-linux.png`.

For an interactive Linux terminal, `yarn vrt:docker` wraps Docker with
`--network host` and `-it`. It expects an already running server and defaults
to `https://localhost:3001`. Override with `--e2e-start-url` for another local
test URL. Use the direct Docker command above in noninteractive agent shells.
Use HTTPS when a browser accesses a non-loopback host.

The matcher and test setup live in [e2e/fixtures.ts](e2e/fixtures.ts).
[playwright.config.ts](playwright.config.ts) sets screenshot tolerance to
`maxDiffPixels: 5` and `threshold: 0.05`. Agent-specific instructions are in
the [VRT skill](../../.claude/skills/running-vrts/SKILL.md).
