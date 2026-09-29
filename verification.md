# Verification

Executed locally on **2026-09-29**. Environment: macOS arm64, Apple M3 Pro, Node **25.7.0**, npm **11.10.1**, Playwright **1.63.0**, Chromium **153.0.8010.12**. The separate [Node 22 / Ubuntu verification run](https://github.com/abhisheksaini333/federated-commerce-retrospective/actions/runs/36570230137) passed at commit `db0591f`: typecheck, 11 API tests, three production builds and 10 Chromium checks. Performance figures below remain the recorded local measurements.

| Command | Observed result | Evidence |
| --- | --- | --- |
| `npm install --no-fund` | Dependency tree installed; lockfile generated | `package-lock.json` |
| `npx playwright install chromium` | Matching browser installed successfully | Chromium version in benchmark JSON |
| `npm run verify` | Exit 0: strict typecheck, **11/11 HTTP tests**, all three production builds, **10/10 Chromium tests** | [Complete output](evidence/2026-09-29-verification.txt) |
| `npm audit --json` | **0** reported vulnerabilities at check time | [Audit JSON](evidence/2026-09-29-dependency-audit.json) |
| `npm run benchmark` | Both production variants and six browser observations completed | [Run output](evidence/2026-09-29-benchmark-run.txt), [raw observations](evidence/2026-09-29-performance.json), [analysis](docs/performance.md) |

The final browser suite completed in **6.1 seconds**. Node printed a harmless runner environment warning that `NO_COLOR` is ignored when `FORCE_COLOR` is also set. The healthy-browser test independently records JavaScript errors, console errors, failed requests and HTTP responses ≥400 and asserts an empty error list.

## Acceptance evidence

| Requirement | Proof |
| --- | --- |
| Catalog → bag → checkout → confirmation → admin fulfillment | Full Chromium journey against the Express API and production federated bundles |
| Real host + two remote boundaries | Three independent webpack outputs and ports; browser tests abort each remote origin separately |
| Catalog remote unavailable | Visible collection recovery; shell/bag still usable; reload recovers after fault removal |
| Cart remote unavailable | Saved quantity/subtotal fallback; bag survives recovery reload |
| API unavailable | 503 message and explicit retry recover without page reload |
| Retry after server accepted but response was lost | Browser sends real request then drops response; second request reuses key; exactly one order |
| Storage disabled during retry | The same lost-response case passes with `Storage.setItem` throwing; in-memory fallback preserves the key |
| Checkout validation and authoritative pricing | HTTP tests cover invalid/unknown fields, price injection, duplicate/unknown product lines, shipping, quantity, required key and malformed/oversized JSON |
| Idempotency under concurrency and reordered JSON | HTTP tests verify one stock decrement/order for concurrent same-key requests and equivalent line/property ordering; changed payload gets 409 |
| No partial stock mutation | A multi-item out-of-stock request leaves earlier lines and order count unchanged |
| Delayed checkout cannot discard later bag edits | Browser holds the response and verifies all shop/bag/admin/back navigation is disabled until submission settles |
| Responsive and healthy rendering | 390 px overflow assertion, desktop no-error assertions, inspected screenshots |
| Measured baseline | Eager cart component versus deferred cart component; raw build, asset and browser samples retained |

Desktop: [screenshot](evidence/2026-09-29-desktop.png). Mobile: [screenshot](evidence/2026-09-29-mobile.png). Product drawings are CSS illustrations and require no external image service.

## Regression sequence

API tests first failed against a route skeleton before implementation: [initial API red](evidence/2026-09-29-api-red.txt). Browser tests first failed against an empty UI after Chromium installation: [initial browser red](evidence/2026-09-29-browser-red.txt). Later targeted tests exposed three defects before their fixes: [storage-disabled retry](evidence/2026-09-29-storage-retry-red.txt), [object-key normalization](evidence/2026-09-29-review-api-red.txt), and [in-flight checkout navigation](evidence/2026-09-29-review-browser-red.txt). The complete final run above includes all regressions passing. Earlier green logs are intermediate run evidence, not the final test count.

## Limits

Tests use local synthetic data and browser fault injection. There is no hosted deployment, real payment, authentication, database persistence, distributed transaction, accessibility certification, cross-browser suite or load test. In-memory stock and idempotency state reset on process restart; browser persistence is scoped to the current tab and cannot survive reload when storage is blocked. The small local benchmark is a loading-cost experiment, not proof of a user-facing speedup. See [runbook](docs/runbook.md) for operational boundaries.
