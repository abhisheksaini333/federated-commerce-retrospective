# ADR 001: Explicit remote boundaries with host-owned state

Status: accepted.

## Context

The project needs a runnable demonstration of microfrontend composition. The main questions are composition, isolated failure, shared dependencies, a real transaction boundary, and measurable costs.

## Decision

Use React 17 and webpack 5 Module Federation with two component remotes and a host. Keep application state and checkout orchestration in the host, and authoritative prices/stock in Express. Use same-origin API proxying. Keep the runtime local and synthetic. Use maintained patches and modern test tools where they do not change the architectural lesson; document those adjustments explicitly.

## Alternatives considered

1. **Single SPA:** simplest operationally and usually the appropriate default for a small store. It cannot demonstrate independent remote availability, so it is not the primary learning artifact here.
2. **Federated React host/remotes:** selected to make loading and failure boundaries observable without mixing frameworks.
3. **Angular/Nx/Next.js expansion:** omitted because it would increase tooling and routing complexity without strengthening the core failure or transaction evidence. It remains a possible independent extension, not a claimed completed feature.

## Consequences

Independent bundles can evolve separately, but require coordinated contracts, trusted remote origins, singleton version compatibility and rollback discipline. The host owns UX recovery, so outages do not imply an empty page. Session storage is a convenience for synthetic carts, not a source of authority. Stock and idempotency are process-local and must move to durable transactions before any real commerce use. Browser performance measures both the early-load benefit and the deferred cost when a user opens the bag.

## Evidence

`tests/unit/api.test.ts` exercises validation, pricing, idempotency, stock and fulfillment. `tests/e2e/storefront.spec.ts` exercises the full journey and failure recovery against production bundles. `scripts/benchmark.ts` compares startup loading with raw observations. See `verification.md` for actual execution results and limits.
