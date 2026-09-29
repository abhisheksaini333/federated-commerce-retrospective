# Cart loading experiment

Measured on **2026-09-29 at 12:41:42 UTC** using the final verified source. [Raw JSON](../evidence/2026-09-29-performance.json) retains every sample, resource URL, browser timing, emitted asset and environment detail. [Runner output](../evidence/2026-09-29-benchmark-run.txt) and the [reproducible script](../scripts/benchmark.ts) are included.

## Question and method

Does waiting to import the cart component until the bag opens reduce initial loading cost, and where does that cost move?

`npm run benchmark` builds two otherwise equivalent production variants:

- **Baseline:** `__EAGER_CART__` imports the cart component at bootstrap.
- **Deferred:** the default host resolves the React lazy cart component only when the bag opens.

Both use the same React singleton, catalog/API, CSS, fixed ports and webpack configuration. Static remote declarations mean webpack still requests the cart container entry during startup share-scope initialization. This comparison defers the **cart implementation chunk**, not every request to the cart origin.

Each build runs once, followed by three fresh browser contexts per variant, with the baseline measured first. Browser cache is empty per context and servers send `Cache-Control: no-store`. The script records catalog visibility, paint/resource timings, then the time from clicking the bag until its empty state becomes visible. It uses `networkidle` only to establish benchmark resource snapshots, not as the browser suite's correctness assertion.

Environment: Apple M3 Pro, macOS arm64, Node 25.7.0, Chromium 153.0.8010.12, 1440 × 1050 viewport, unthrottled loopback HTTP. Other workspace activity was not controlled.

## Observations

Page values below are medians of three samples. Resource counts and byte totals were identical across the three samples of each variant.

| Measure | Eager baseline | Deferred cart |
| --- | ---: | ---: |
| Build wall time, one sample | 2,826 ms | 2,029 ms |
| Emitted JS + HTML across all three builds | 268,451 bytes | 268,406 bytes |
| Sum of individually gzipped assets, modeled | 85,569 bytes | 85,556 bytes |
| Startup resource requests | 9 | 8 |
| Startup requests to cart origin | 2 | 1 |
| Startup resource transfer-size sum | 251,954 bytes | 248,220 bytes |
| Startup encoded-body-size sum | 249,254 bytes | 245,820 bytes |
| First contentful paint | 80 ms | 88 ms |
| Largest contentful paint at startup snapshot | 80 ms | 88 ms |
| Catalog ready, navigation to visible add control | 93.3 ms | 106.7 ms |
| Bag ready, click to visible empty state | 65.9 ms | 117.5 ms |
| Resource transfer sum after bag opens | 251,954 bytes | 251,909 bytes |
| Uncaught page errors, all samples | 0 | 0 |

Deferring the cart saved **one initial request and 3,734 transfer bytes (1.48%)**, while the median bag-open observation rose by **51.6 ms**. Almost the same total bytes were loaded after opening the bag: the work moved later. The catalog and paint timings do **not** show a speed improvement in this run.

## Interpretation and limits

This is a small demonstration with a small cart component. Its result supports the request/byte deferral mechanism, not a broad claim that microfrontends or lazy loading make storefronts faster. A larger cart may benefit more; a frequently opened cart may make preloading preferable. Both need their own measurement.

The browser Resource Timing sums exclude the main HTML navigation and reflect browser-reported transfer sizes. The server does not enable HTTP compression; gzip totals describe modeled emitted artifacts, not observed transfer. Emitted totals include unused runtime/vendor alternatives across independent builds, exclude source maps, and are not equivalent to page download size.

Three samples, unthrottled loopback, a fixed variant order, a shared busy machine and a single build observation are insufficient for statistical inference. The build-time difference cannot be attributed to this optimization. Production conclusions require randomized/repeated runs, representative mobile CPU/network profiles, field data, comparable cache/CDN behavior and explicit user-experience budgets.
