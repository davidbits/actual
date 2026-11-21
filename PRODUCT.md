# Product

## Register

product

## Users

The owner of this personal fork, managing spending, payments, and on/off-budget accounts across desktop and mobile browsers. Core workflows are reconciling accounts, categorizing transactions, adjusting budgets, and reviewing reports. The app is self-hosted, with local browser storage and device sync.

## Product Purpose

This fork retains Actual's financial tools: accounts, transactions, payments, budgets, imports, bank sync, schedules, rules, reconciliation, and reports. The API and CLI remain available for integrations. Native apps, sharing, user management, tours, release news, and app plugin scaffolding are removed.

Budget storage and processing run in the browser or local integration process, with a self-hosted sync server. Optional bank connections and OpenID authentication communicate with their configured external providers. Selecting a repository-based custom theme can download CSS and font assets from GitHub. Success means trustworthy balances, fast routine tasks, and reliable synchronization between the owner's devices.

## Brand Personality

Calm, trustworthy, practical. The interface should feel like a dependable tool that stays out of the way: quiet confidence, no flash, no urgency theatrics. Money is stressful enough — the UI's job is to make it feel manageable and under control.

## Anti-references

- Fintech-startup gloss: gradient heroes, glassmorphism, crypto-dashboard neon.
- Corporate banking UI: navy-and-gold, enterprise-portal density, legalese energy.

## Design Principles

- **The numbers are the interface.** Financial figures are the primary content; typography, alignment, and tabular numerals serve legibility of amounts above all decoration.
- **Trust through restraint.** No visual tricks that could make users doubt what they're seeing. Boring and correct beats clever.
- **Fast routine, gentle depth.** Everyday tasks (categorize, reconcile, budget) must be frictionless; power features reveal themselves progressively without cluttering the default view.
- **Local-first honesty.** The UI reflects the product's values: no dark patterns, no upsells, no attention-grabbing — the user owns the tool, not the other way around.
- **Consistent across surfaces.** Desktop and mobile browsers share one design language via the shared component library; new work reuses existing components and theme tokens.

## Accessibility & Inclusion

Design target: WCAG 2.1 AA, including sufficient contrast, keyboard navigation, reduced-motion support, and meaning conveyed beyond color. This is a review target, not a claim that every screen has been audited for conformance. Check built-in light, dark, and midnight themes and relevant custom-theme behavior.
