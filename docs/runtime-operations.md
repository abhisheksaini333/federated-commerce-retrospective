# Runtime and release checks

Build all three containers with `npm run build`. Start with `npm start`; runtime validates host HTML and both remote entries before opening listeners. Asset paths resolve from this checkout, independently of the working directory. Ports use `COMMERCE_HOST_PORT`, `COMMERCE_CATALOG_PORT`, `COMMERCE_CART_PORT`, and `COMMERCE_API_PORT` (4310–4313 by default). Ports must be distinct positive integers. `BUILD_VARIANT` accepts `optimized` or `baseline`. Remote URLs must match these ports in the runtime federation configuration.

Shutdown drains accepted requests for `COMMERCE_SHUTDOWN_MS` (default 5000, maximum 60000), then closes remaining connections. Proxy inactivity is bounded by `COMMERCE_API_TIMEOUT_MS` (default 4500). These are local demo boundaries: trusted Host and browser Origin checks supplement application authorization; they do not authenticate command-line clients. Requests without Origin are accepted. CSP permits only the configured loopback script origins and styles injected by the existing bundler. Timing details are disclosed only to known origins.

Run `node node_modules/tsx/dist/cli.mjs scripts/release-smoke.ts` after building. It starts the actual server from a new temporary working directory and checks both federated views with Chromium. Stop other servers on the configured ports first. The smoke command closes its child process and browser even on failure.

Generate full webpack JSON statistics and run `node node_modules/tsx/dist/cli.mjs scripts/check-build.ts <statistics.json>` to enforce 250000-byte individual deployable assets and 600000-byte aggregate container budgets. All three containers must be present. Source maps are excluded. Incomplete, duplicate, errored or oversized statistics fail the gate.

## Benchmark runs

Use `npm run benchmark -- --output /absolute/path/to/a/new/run --samples 5`. The output directory must not already exist. Existing evidence is preserved. Each report includes the source commit and dirty state, environment, full raw samples, per-variant min/max/mean/median/p95 and the exact sample order. Samples alternate which variant runs first; each launches a clean server and browser context. There is no warmup exclusion. This is unthrottled local-browser evidence, not a production latency or statistical-significance claim. Keep hardware load comparable between runs. Request readiness and child termination are bounded; partial build/server logs remain in the run directory when a run fails.

The host serves `/runtime-config.js` with the configured catalog/cart origins. The federation loader accepts only HTTP loopback remote entries at `/remoteEntry.js`, initializes the shared React scope once per container, and follows configured ports without rebuilding the host. No external remote registry is used.
