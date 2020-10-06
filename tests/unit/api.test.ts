import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../apps/api/app";

const body = {
  items: [{ productId: "notebook", quantity: 2 }],
  customerName: "Alex Demo",
  shipping: "standard",
};
const checkout = (
  app: ReturnType<typeof createApp>,
  key = "test-order-001",
  payload: unknown = body,
) =>
  request(app)
    .post("/api/checkout")
    .set("Idempotency-Key", key)
    .set("Content-Type", "application/json")
    .send(JSON.stringify(payload));

test("catalog exposes synthetic products with integer cents and fresh stock", async () => {
  const response = await request(createApp()).get("/api/products");
  assert.equal(response.status, 200);
  assert.equal(response.body.products.length, 6);
  assert.equal(response.body.products[0].id, "notebook");
  assert.equal(response.body.products[0].priceCents, 2400);
});

test("checkout computes authoritative totals, decrements stock and records the order", async () => {
  const app = createApp();
  const response = await checkout(app);
  assert.equal(response.status, 201);
  assert.equal(response.body.order.totalCents, 5400);
  assert.equal(response.body.order.subtotalCents, 4800);
  assert.equal(response.body.order.status, "placed");
  const products = await request(app).get("/api/products");
  assert.equal(products.body.products[0].stock, 10);
  const orders = await request(app).get("/api/orders");
  assert.equal(orders.body.orders.length, 1);
});

test("concurrent identical retries create one order and decrement stock once", async () => {
  const app = createApp();
  const responses = await Promise.all([
    checkout(app),
    checkout(app),
    checkout(app),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 201]);
  assert.equal(new Set(responses.map((r) => r.body.order.id)).size, 1);
  assert.equal(
    (await request(app).get("/api/products")).body.products[0].stock,
    10,
  );
});

test("same key with changed payload is rejected", async () => {
  const app = createApp();
  await checkout(app);
  const result = await checkout(app, "test-order-001", {
    ...body,
    shipping: "express",
  });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "IDEMPOTENCY_CONFLICT");
});

test("semantically identical object key ordering replays the original order", async () => {
  const app = createApp();
  const first = await checkout(app, "object-key-order", body);
  assert.equal(first.status, 201);
  const replay = await checkout(app, "object-key-order", {
    shipping: body.shipping,
    customerName: body.customerName,
    items: body.items.map((item) => ({
      quantity: item.quantity,
      productId: item.productId,
    })),
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.order.id, first.body.order.id);
  assert.equal((await request(app).get("/api/orders")).body.orders.length, 1);
});

test("equivalent item ordering replays the original order", async () => {
  const app = createApp();
  const payload = {
    ...body,
    items: [...body.items, { productId: "pencil", quantity: 1 }],
  };
  const first = await checkout(app, "canonical-key", payload);
  const replay = await checkout(app, "canonical-key", {
    ...payload,
    items: [...payload.items].reverse(),
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.order.id, first.body.order.id);
});

test("rejects invalid quantities, unknown products, duplicates, invalid shipping and forged prices", async () => {
  for (const payload of [
    { ...body, items: [{ productId: "notebook", quantity: 0 }] },
    { ...body, items: [{ productId: "notebook", quantity: 1.5 }] },
    { ...body, items: [{ productId: "missing", quantity: 1 }] },
    { ...body, items: [...body.items, ...body.items] },
    { ...body, shipping: "teleport" },
    { ...body, customerName: "" },
    { ...body, totalCents: 1 },
    { ...body, items: [{ productId: "notebook", quantity: 1, priceCents: 1 }] },
    { ...body, items: [] },
    null,
  ]) {
    const result = await checkout(createApp(), "validation-key", payload);
    assert.equal(result.status, 400, JSON.stringify(payload));
  }
});

test("requires a bounded idempotency key", async () => {
  assert.equal(
    (await request(createApp()).post("/api/checkout").send(body)).status,
    400,
  );
  assert.equal((await checkout(createApp(), "x".repeat(101))).status, 400);
});

test("stock conflict cannot create a partial order", async () => {
  const app = createApp();
  const result = await checkout(app, "stock-conflict", {
    ...body,
    items: [...body.items, { productId: "lamp", quantity: 5 }],
  });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "OUT_OF_STOCK");
  assert.equal(
    (await request(app).get("/api/products")).body.products[0].stock,
    12,
  );
  assert.equal((await request(app).get("/api/orders")).body.orders.length, 0);
});

test("admin can fulfill an order, repeated fulfillment is harmless, invalid transitions fail", async () => {
  const app = createApp();
  const result = await checkout(app);
  const url = `/api/orders/${result.body.order.id}`;
  assert.equal(
    (await request(app).patch(url).send({ status: "cancelled" })).status,
    400,
  );
  assert.equal(
    (await request(app).patch(url).send({ status: "fulfilled" })).body.order
      .status,
    "fulfilled",
  );
  assert.equal(
    (await request(app).patch(url).send({ status: "fulfilled" })).status,
    200,
  );
  assert.equal(
    (
      await request(app)
        .patch("/api/orders/unknown")
        .send({ status: "fulfilled" })
    ).status,
    404,
  );
});

test("invalid JSON and oversized bodies return bounded structured errors", async () => {
  const app = createApp();
  const malformed = await request(app)
    .post("/api/checkout")
    .set("Content-Type", "application/json")
    .send("{");
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.code, "INVALID_JSON");
  const large = await checkout(app, "oversized-key", {
    ...body,
    customerName: "x".repeat(20_000),
  });
  assert.equal(large.status, 413);
});


test("API fixture options isolate catalog prices and deterministic order identity", async () => {
  const app = createApp({ products: [{ id: 'fixture', name: 'Fixture', category: 'Tools', description: 'Synthetic', priceCents: 1500, stock: 2, color: '#fff', artwork: 'pencil' }], now: () => new Date('2000-01-01T00:00:00Z'), idFactory: () => 'fixture-order' });
  const response = await checkout(app, 'fixture-key', { ...body, items: [{ productId: 'fixture', quantity: 1 }] });
  assert.equal(response.status, 201);
  assert.equal(response.body.order.id, 'fixture-order');
  assert.equal(response.body.order.createdAt, '2000-01-01T00:00:00.000Z');
  assert.equal(response.body.order.totalCents, 2100);
  assert.equal((await request(createApp()).get('/api/products')).body.products[0].priceCents, 2400);
});


test("parser rejections retain no-store and nosniff headers", async () => {
  const response = await request(createApp()).post('/api/checkout').set('Content-Type', 'application/json').send('{');
  assert.equal(response.status, 400);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
});
