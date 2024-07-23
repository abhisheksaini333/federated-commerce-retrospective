# Local API contracts

All paths are case-sensitive. Prices and totals are safe integer US cents. Mutation bodies use UTF-8 JSON, limited to 16 KB. Errors contain `code` and `error`; checkout validation also returns bounded `{path,message}` issues. Administrative endpoints require a Bearer capability when `COMMERCE_ADMIN_TOKEN` is configured.

| Resource | Contract |
| --- | --- |
| `GET /api/products` | Products and inventory `revision`; ETag `"inventory-N"` |
| `POST /api/checkout/quote` | Validated intent; authoritative lines/totals and revision; no stock change |
| `POST /api/checkout` | `Idempotency-Key`; optional inventory `If-Match`; 201 accepted, 200 original receipt replay |
| `POST /api/checkout/resolve` | Matching intent/key; `status: unknown` or `status: accepted` with current order; never creates an order |
| `GET /api/orders` | `limit` 1–100, `after` cursor, optional `status` and customer `q`; `orders`, matching `total`, nullable `nextCursor` |
| `GET /api/orders/:id` | Current order with positive integer version and order ETag |
| `PATCH /api/orders/:id` | Placed to fulfilled/cancelled; optional order `If-Match`; equivalent repeats are harmless |
| `GET /api/orders/export.csv` | Quoted synthetic order CSV with formula-prefix protection |
| `PATCH /api/inventory/:id` | Nonzero integer delta up to 1000, with reason; no negative/unsafe stock |
| `PATCH /api/inventory/:id/count` | Nonnegative safe count and reason; current inventory `If-Match` required |
| `GET /api/stats`, `/api/audit`, `/api/metrics` | Global state totals, bounded accepted-event history, fixed-cardinality request counters |
| `GET /api/session` | Whether administrative capability protection is enabled |
| `GET /api/live`, `/api/ready`, `/api/health` | Liveness, readiness, compatibility health response |

Checkout replays precede availability and revision checks. Original receipts are immutable even after fulfillment or cancellation. An uncertain client outcome retains the exact intent/key, disables edits, and offers receipt lookup or a same-key retry. Corrupt successful responses remain uncertain. The client validates receipt resolution, order versions, inventory revisions, list pagination and product schemas before applying server data.

Inventory revisions advance only on accepted mutations. Absolute counts reject stale revisions; cancellation preflights every line and changes no state if any restock would overflow. Fulfilled orders cannot be cancelled. The demo store and metrics reset when the process restarts.

Statistics sum stock and order values exactly before converting to JSON numbers. An aggregate outside the supported safe-integer range returns `503 AGGREGATE_OVERFLOW`, without modifying orders or inventory, rather than returning rounded counts or cents.

Inventory audit details include the trimmed NFC-normalized adjustment reason for both count and delta changes. These events are available through the protected administrative audit endpoint.
