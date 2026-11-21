---
name: running-vrts
description: Add, run, update, or debug Actual visual regression tests and screenshots. Use when UI changes need screenshot coverage. Generate and compare snapshots in the pinned Linux Playwright Docker image, and scope updates to affected tests.
---

# Running Actual Visual Regression Tests

VRTs are Playwright tests in `packages/desktop-client/e2e/` that call
`expect(target).toMatchThemeScreenshots()`. Read the
[web testing guide](../../../packages/desktop-client/README.md) for executable
local commands and prerequisites. Run Yarn from the repository root.

## Matcher Behavior

- Import `expect` and `test` from local `./fixtures`, not `@playwright/test`.
- With `VRT` unset, the screenshot matcher is a no-op. Run the affected
  functional test first with `yarn e2e <file> -g '<test name>'`.
- `yarn vrt` sets `VRT=true`. Each assertion captures `auto`, `dark`, and
  `midnight`. `auto` follows the preferred color scheme; it is light in the
  default test context.
- Prefer a tight locator over a whole page for a component screenshot.
  `[data-popover]` is useful for popovers. Mask volatile content with
  `data-vrt-mask="true"`.
- `e2e/fixtures.ts` defines the matcher; `playwright.config.ts` sets
  `maxDiffPixels: 5` and `threshold: 0.05`.
- Use the demo budget through `ConfigurationPage.createTestFile()` and page
  models from `e2e/page-models/`. Demo transactions use fixed historical dates;
  UI elements that depend on today's date may still need masking.

## Local Snapshot Workflow

Build with `yarn build:browser`, then run the affected functional tests using
`E2E_USE_BUILD=1`. Playwright starts its own static server unless
`E2E_START_URL` is set. Do not reuse an old dev server for a build check.

Generate and compare snapshots inside
`mcr.microsoft.com/playwright:v1.61.1-jammy`. Keep the image tag aligned with
`@playwright/test` in `packages/desktop-client/package.json` and `bin/run-vrt`.
Use an already cached image and dependencies for offline work.

The web guide's direct Docker command works without a TTY and runs the built
app inside the container with external networking disabled. It avoids the
interactive `-it` requirement of `yarn vrt:docker`. That wrapper instead
connects to an existing server using host networking and defaults to
`https://localhost:3001`.

For an intended visual change:

1. Select affected files and test names. Scope `--update-snapshots` with both
   file arguments and `-g`; include any prerequisite tests in a serial group.
2. Run the selected tests in Docker with `--update-snapshots`.
3. Inspect changed PNGs. Committed snapshots must end in
   `-chromium-linux.png`; host-generated images can differ in rendering.
4. Run the same selection without `--update-snapshots` and require it to pass.
5. Include tests and their PNGs together when committing. Follow
   [AGENTS.md](../../../AGENTS.md) for commit conventions.

If Docker or its cached image is unavailable, report that visual verification
is incomplete. Do not substitute host snapshots or a remote workflow. This
fork has no GitHub screenshot-generation workflow, and GitHub access is
prohibited.
