# Federated commerce implementation plan

**Goal:** Deliver a runnable microfrontend commerce application, with synthetic shopping, failure recovery, and measured evidence.

**Architecture:** A React 17 host composes independently built catalog and cart remotes through webpack 5 Module Federation. The host owns cart state and API communication; the Express API owns prices, stock and idempotent order creation. All services bind to loopback and all data is synthetic and ephemeral.

**Tech stack:** React 17.0.2, patched webpack 5, TypeScript, Express 4, Node native test runner via tsx, Playwright Chromium.

Work stays within the project directory.

1. **Contracts/API:** Write HTTP tests for catalog, price authority, validation, concurrent/idempotent replay, stock conflict and order fulfillment; observe red; implement contracts and Express service; run green.
2. **Host/remotes:** Write browser scenarios before UI implementation. Build a warm editorial stationery store with catalog filters, cart quantities, demo checkout, confirmation and admin order table. Independent remote boundaries keep the shell useful during an outage.
3. **Recovery:** Test catalog/cart remote failure and API outage followed by retry. Preserve cart during transport failure, and reuse a checkout key only for the unchanged payload to make an ambiguous response safe to retry.
4. **Verification:** Typecheck, unit/API tests, production builds, isolated Chromium browser suite and responsive screenshot; fix observed defects with focused regressions.
5. **Baseline:** Compare eager versus on-demand cart remote loading in otherwise equivalent production builds; retain raw asset/build and fresh-context page observations. State sample/environment limits without invented speedup claims.
6. **Handoff:** README, MIT license, architecture, ADR, runbook, dependency release sources, CI and exact verification evidence with remaining limitations.
