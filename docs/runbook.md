# Local runbook

## Start and stop

Run `npm ci`, `npm run build`, then `npm start`. Open `http://127.0.0.1:4310`. Ctrl+C stops all four HTTP listeners. Rebuild after editing source. All services bind to loopback; data is synthetic and resets on service restart.

| Service | Endpoint | Healthy observation |
| --- | --- | --- |
| Host | `http://127.0.0.1:4310` | Storefront renders and catalog buttons become available |
| Catalog | `http://127.0.0.1:4311/remoteEntry.js` | JavaScript container returns 200 |
| Cart | `http://127.0.0.1:4312/remoteEntry.js` | JavaScript container returns 200 |
| API | `http://127.0.0.1:4313/api/health` | JSON status is `ok` |

If startup reports `EADDRINUSE`, stop the existing process that owns the named port. Tests deliberately refuse to reuse an arbitrary running service. To inspect local listeners: `lsof -nP -iTCP:4310-4313 -sTCP:LISTEN`.

## Shopping and fulfillment

1. Filter or search the collection; add a product and open **Bag**.
2. Adjust quantities or remove lines. Continue to checkout.
3. Use a made-up demo name, choose delivery and place the demo order.
4. Open **Order desk** and mark the new order fulfilled. Refresh checks current server state.

There is no payment provider, authentication, shipping integration, persistence or cancellation workflow. The order desk is appropriate only for this local synthetic environment.

## Failure exercises

The executable exercises live in `tests/e2e/storefront.spec.ts`. Run `npm run build && npm run test:e2e`; Playwright starts and stops the servers itself.

- **Catalog remote unavailable:** browser interception aborts `:4311` requests. The host displays a recovery panel; bag and navigation continue working. Remove the interception, reload the collection and catalog controls return.
- **Cart remote unavailable:** add an item, abort `:4312`, then open the bag. A saved quantity/subtotal remains visible. Remove interception and reload; the session-scoped bag returns.
- **API unavailable:** a 503 response is injected for product loading. The recovery panel displays the server message and **Try again** fetches after the fault is removed.
- **Ambiguous checkout response:** the test sends a real checkout to the API but drops the response. Retrying reuses the same key and produces one order. This models a transport failure after server acceptance.

Remote recovery reloads the page because rejected React lazy imports and webpack remote runtime state may remain cached. Ordinary API retry does not reload. A blocked storage policy prevents persistence across reloads. An in-memory fallback retains the bag and retry key within the current page lifetime, and a dedicated browser test verifies duplicate suppression with storage disabled.

For a manual remote outage, use browser request blocking for the remote origin and reload. Disable blocking before pressing the recovery action. For an API outage, block `/api/products`; remove the block and retry. Do not interpret browser fault injection as infrastructure fault-tolerance evidence.

## Checkout invariants

The API requires a bounded `Idempotency-Key`, valid synthetic customer name, recognized shipping option, and unique product lines with integer quantities 1–10. It owns prices and stock. Same key plus canonical-equivalent payload replays the order; changed payload with the same key returns 409. Out-of-stock rejection makes no partial stock mutation. Client-side controls are convenience only; all invariants are validated at the API.

## CI and evidence

`npm run verify` performs strict typecheck, HTTP tests, production build and Chromium browser checks. CI uses Node 22 on Ubuntu and uploads the browser report/artifacts; a local run does not establish that hosted CI passed. `npm run benchmark` records both bundle variants and six fresh-context page observations. Raw evidence contains actual runtime versions, sample values and resource URLs.

For real deployment, replace the in-memory store with transactional durable storage, implement authorization and CSRF/origin policy, use trusted versioned HTTPS remote manifests and CSP, establish dependency update/rollback controls, and integrate a real provider only under a separate approved scope.


Optional administrative capability: set `COMMERCE_ADMIN_TOKEN` to 16–256 URL-safe characters before `npm start`. The order desk prompts for it; the client holds it only in memory and sends it only to administrative API paths. Catalog and synthetic checkout remain public. This loopback capability is a demo access boundary, not an identity provider. API callers use `Authorization: Bearer <capability>`; query parameters never authenticate.

Mutation budgets default to 200 attempts per minute for each local client and operation group (checkout or administration). A `429 RATE_LIMITED` response includes `Retry-After` seconds. Accepted checkout replay and receipt resolution stay available during a checkout budget limit.
