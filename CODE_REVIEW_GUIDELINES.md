# CODE_REVIEW_GUIDELINES.md - Guidelines for LLM Agents Performing Code Reviews

This document provides specific guidelines for LLM agents performing code reviews on the Actual Budget codebase. These guidelines help maintain code quality, consistency, and follow the project's design principles.

## Settings Proliferation

**Do NOT add new settings for every little UI tweak.**

Actual Budget follows a design philosophy that prioritizes simplicity and avoids settings bloat. Before introducing code that adds new settings:

- Consider if the UI tweak can be achieved through existing theme/design tokens
- Evaluate whether the setting provides meaningful value to users
- Check if the change aligns with Actual's design guidelines
- Prefer hardcoded values or theme-based solutions over adding user-facing settings

## TypeScript Strict Mode Suppressions

**Do NOT approve code that adds new `@ts-strict-ignore` comments.**

`yarn typecheck` runs the native TypeScript compiler (`tsgo`) and workspace
checks. Core, web, API, and sync-server checks also run `tsc-strict` from
`typescript-strict-plugin`; legacy files may already opt out. New files must
remain strict. Review should encourage:

- Fixing the underlying type issue
- Using proper type definitions
- Refactoring code to satisfy strict type checking
- Only in exceptional cases, document why strict checking cannot be applied and seek alternative solutions

## Linter Suppressions

**Do NOT approve code that adds new `eslint-disable` or `oxlint-disable` comments.**

Linter rules are in place for good reasons. Instead of suppressing them:

- Fix the underlying issue
- If the rule is incorrectly flagging valid code, consider if the code can be refactored
- Follow the fork rule in `AGENTS.md`: do not add new lint suppressions

## Type Assertions

**Use `satisfies` to check an expression against a type without replacing its inferred type.**

The `satisfies` operator provides better type safety by:

- Checking assignability at compile time
- Preserving the actual type information for better inference
- Catching type mismatches at compile time

`satisfies` does not coerce values, validate runtime input, or replace a runtime
type guard. Narrow untrusted values with checks. If an assertion is still
necessary, explain the invariant that makes it safe.

## Untrusted Values and `any`

**Avoid `any`; use `unknown` for values that need runtime validation.**

For untyped input, errors, and parsed data, `unknown` preserves type checking
until the value is narrowed. Before approving an `any` or unchecked assertion:

- Require explicit justification for why the type cannot be determined
- Suggest using proper type definitions or generics
- Consider if the type can be narrowed or properly inferred
- Look for existing type definitions in `packages/loot-core/src/types/`

Use existing types or generics for known data, and check external values before
using them. Keep unavoidable `any` at the narrowest interop boundary.

## Internationalization (i18n)

**All user-facing strings must be translated.**

Oxlint loads the local ESLint-compatible rules, including
`actual/no-untranslated-strings`, from `packages/eslint-plugin-actual`.
Reviewers should still flag untranslated application UI strings:

- Use `Trans` component instead of `t()` function when possible
- All text visible to users must use i18n functions
- Flag hardcoded strings that should be translated

## Test Mocking

**Minimize mocked dependencies; prefer real implementations.**

When reviewing tests, encourage the use of real implementations over mocks:

- Prefer real dependencies, utilities, and data structures
- Only mock when the real implementation is impractical (e.g., external APIs, file system in unit tests)
- Ensure mocks accurately represent real behavior

Over-mocking makes tests brittle and less reliable. Real implementations provide better confidence that code works correctly.

## Financial Number Typography

Standalone financial numbers should have tabular number styles applied.

- Standalone financial numbers should be wrapped with `FinancialText` or `styles.tnum` should be applied directly if wrapping is not possible

## Related Documentation

- [AGENTS.md](AGENTS.md): local development rules.
- [MAINTENANCE.md](MAINTENANCE.md): fork scope and operating procedures.
