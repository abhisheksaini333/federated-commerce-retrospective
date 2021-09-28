import assert from "node:assert/strict";
import { test } from "node:test";
import { request } from '../support/http';
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
    (await request(app).patch(url).send({ status: "shipped" })).status,
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


test("unsupported charset and malformed route escapes remain client errors", async () => {
  const app = createApp();
  const charset = await request(app).post('/api/checkout').set('Content-Type', 'application/json; charset=bogus').send(JSON.stringify(body));
  assert.equal(charset.status, 415);
  assert.equal(charset.body.code, 'UNSUPPORTED_MEDIA_TYPE');
  const uri = await request(app).patch('/api/orders/%').send({status:'fulfilled'});
  assert.equal(uri.status, 400);
  assert.equal(uri.body.code, 'INVALID_REQUEST');
  assert.equal(uri.body.error.includes('URIError'), false);
});


test("mutation routes reject non-JSON bodies without creating orders", async () => {
 const app=createApp();
 for (const mime of ['text/plain', 'application/x-www-form-urlencoded']) {
  const response=await request(app).post('/api/checkout').set('Content-Type',mime).set('Idempotency-Key','mime-contract').send(JSON.stringify(body));
  assert.equal(response.status,415,JSON.stringify({body:response.body,headers:response.headers,url:response.request.url}));
  assert.equal(response.body.code,'UNSUPPORTED_MEDIA_TYPE');
 }
 assert.equal((await request(app).get('/api/orders')).body.orders.length,0);
 assert.equal((await checkout(app)).status,201);
});


test("known resources expose allowed methods while missing routes remain 404", async () => {
 const app=createApp();
 const response=await request(app).delete('/api/products');
 assert.equal(response.status,405); assert.equal(response.headers.allow,'GET, HEAD');
 assert.equal(response.body.code,'METHOD_NOT_ALLOWED');
 assert.equal((await request(app).delete('/api/missing')).status,404);
 assert.equal((await request(app).head('/api/products')).status,200);
});


test("checkout validation returns actionable field paths", async () => {
 const result=await checkout(createApp(),'field-errors',{...body,customerName:'',items:[{productId:'notebook',quantity:0}]});
 assert.equal(result.status,400);
 assert.deepEqual(result.body.issues.map((issue: {path:string})=>issue.path).sort(),['customerName','items.0.quantity']);
 assert.equal((await checkout(createApp(),'unknown-fields',{...body,unexpected:true})).body.issues[0].path,'unexpected');
});


test("demo names preserve normalized Unicode and reject embedded controls", async () => {
 const app=createApp();
 const good=await checkout(app,'unicode-name',{...body,customerName:'  Jose\u0301 Demo  '});
 assert.equal(good.status,201); assert.equal(good.body.order.customerName,'José Demo');
 const bad=await checkout(app,'control-name',{...body,customerName:'Alex\nAdmin'});
 assert.equal(bad.status,400); assert.equal(bad.body.issues[0].path,'customerName');
});


test("invalid catalog configuration fails before serving corrupt prices or inventory", () => {
 const base={id:'fixture',name:'Fixture',category:'Tools' as const,description:'Demo',priceCents:100,stock:2,color:'#fff',artwork:'pencil' as const};
 for(const invalid of [{...base,priceCents:-1},{...base,stock:1.5},{...base,id:'../escape'},{...base,color:'url(secret)'}]) assert.throws(()=>createApp({products:[invalid]}),/catalog/i);
 assert.throws(()=>createApp({products:[base,base]}),/catalog/i);
});


test("order identity uses full entropy and collisions cannot overwrite receipts", async () => {
 const normal=await checkout(createApp());
 assert.match(normal.body.order.id,/^FW-[A-F0-9-]{36}$/);
 const app=createApp({idFactory:()=> 'collision-order'});
 assert.equal((await checkout(app,'first-collision')).status,201);
 const next=await checkout(app,'second-collision');
 assert.equal(next.status,503); assert.equal(next.body.code,'IDENTITY_UNAVAILABLE');
 assert.equal((await request(app).get('/api/orders')).body.orders.length,1);
 assert.equal((await request(app).get('/api/products')).body.products[0].stock,10);
});


test("idempotent receipts preserve their original response after fulfillment", async () => {
 const app=createApp(); const first=await checkout(app,'snapshot-key');
 await request(app).patch(`/api/orders/${first.body.order.id}`).send({status:'fulfilled'});
 const replay=await checkout(app,'snapshot-key');
 assert.equal(replay.status,200); assert.equal(replay.body.replayed,true);
 assert.deepEqual(replay.body.order,first.body.order);
 assert.equal((await request(app).get('/api/orders')).body.orders[0].status,'fulfilled');
});


test("individual order lookup returns authoritative state and hides absent records", async () => {
 const app=createApp();const placed=await checkout(app,'detail-key');
 const detail=await request(app).get(`/api/orders/${placed.body.order.id}`);
 assert.equal(detail.status,200);assert.deepEqual(detail.body.order,placed.body.order);
 const absent=await request(app).get('/api/orders/unknown');assert.equal(absent.status,404);assert.equal(absent.body.code,'NOT_FOUND');
});


test("checkout resolution verifies intent and never creates a missing receipt", async () => {
 const app=createApp();const resolve=(payload:unknown=body)=>request(app).post('/api/checkout/resolve').set('Idempotency-Key','resolution-key').send(payload as object);
 const unknown=await resolve();assert.equal(unknown.status,200);assert.equal(unknown.body.status,'unknown');
 const placed=await checkout(app,'resolution-key');const accepted=await resolve();
 assert.equal(accepted.body.status,'accepted');assert.equal(accepted.body.order.id,placed.body.order.id);
 assert.equal((await resolve({...body,shipping:'express'})).status,409);
 assert.equal((await request(app).get('/api/orders')).body.orders.length,1);
});


test("checkout quotes compute authoritative prices without consuming inventory", async () => {
 const app=createApp();const response=await request(app).post('/api/checkout/quote').send({...body,shipping:'express'});
 assert.equal(response.status,200);assert.equal(response.body.quote.subtotalCents,4800);assert.equal(response.body.quote.totalCents,6000);
 assert.equal((await request(app).get('/api/products')).body.products[0].stock,12);
 assert.equal((await request(app).get('/api/orders')).body.orders.length,0);
 assert.equal((await request(app).post('/api/checkout/quote').send({...body,totalCents:1})).status,400);
});


test("inventory revision advances only after accepted mutations", async () => {
 const app=createApp();const before=await request(app).get('/api/products');
 assert.equal(before.body.revision,0);assert.equal(before.headers.etag,'"inventory-0"');
 await checkout(app,'revision-key');await checkout(app,'revision-key');
 const after=await request(app).get('/api/products');assert.equal(after.body.revision,1);
 const quote=await request(app).post('/api/checkout/quote').send(body);assert.equal(quote.body.quote.revision,1);
 await checkout(app,'bad-revision',{...body,items:[]});assert.equal((await request(app).get('/api/products')).body.revision,1);
});


test("checkout preconditions reject stale quotes but allow accepted receipt replay", async () => {
 const app=createApp();
 const submit=(key:string)=>request(app).post('/api/checkout').set('Idempotency-Key',key).set('If-Match','"inventory-0"').send(body);
 const first=await submit('quoted-order-one');assert.equal(first.status,201);
 const stale=await submit('quoted-order-two');assert.equal(stale.status,412);assert.equal(stale.body.code,'PRECONDITION_FAILED');
 assert.equal((await submit('quoted-order-one')).status,200);
 assert.equal((await request(app).get('/api/products')).body.products[0].stock,10);
});


test("stock conflicts identify every unavailable product and current quantity", async () => {
 const app=createApp();const response=await checkout(app,'stock-details',{...body,items:[{productId:'lamp',quantity:8},{productId:'tote',quantity:9}]});
 assert.equal(response.status,409);
 assert.deepEqual(response.body.stockConflicts,[{productId:'lamp',requested:8,available:4},{productId:'tote',requested:9,available:8}]);
 assert.equal((await request(app).get('/api/orders')).body.orders.length,0);
});


test("cancellation restores stock once and cannot reverse fulfilled orders", async () => {
 const app=createApp();const placed=await checkout(app,'cancel-once');const url=`/api/orders/${placed.body.order.id}`;
 assert.equal((await request(app).patch(url).send({status:'cancelled'})).body.order.status,'cancelled');
 assert.equal((await request(app).patch(url).send({status:'cancelled'})).status,200);
 assert.equal((await request(app).get('/api/products')).body.products[0].stock,12);
 assert.equal((await request(app).patch(url).send({status:'fulfilled'})).status,409);
 const second=await checkout(app,'fulfilled-no-cancel');const secondUrl=`/api/orders/${second.body.order.id}`;
 await request(app).patch(secondUrl).send({status:'fulfilled'});
 assert.equal((await request(app).patch(secondUrl).send({status:'cancelled'})).status,409);
 assert.equal((await request(app).get('/api/products')).body.products[0].stock,10);
});


test("inventory adjustments apply bounded deltas atomically with a reason", async () => {
 const app=createApp();const adjust=(delta:number,reason='Count correction')=>request(app).patch('/api/inventory/notebook').send({delta,reason});
 assert.equal((await adjust(-2)).body.product.stock,10);
 const results=await Promise.all([adjust(3),adjust(2)]);assert.deepEqual(results.map(r=>r.status),[200,200]);
 assert.equal((await request(app).get('/api/products')).body.products[0].stock,15);
 for(const delta of [-16,0,0.5,1001])assert.equal((await adjust(delta)).status,400);
 assert.equal((await adjust(1,'')).status,400);
 assert.equal((await request(app).get('/api/products')).body.products[0].stock,15);
});


test("order pagination uses stable cursors and bounded validated limits", async () => {
 const app=createApp();for(let i=0;i<3;i++)await checkout(app,`page-key-${i}`);
 const first=await request(app).get('/api/orders?limit=2');assert.equal(first.body.orders.length,2);assert.equal(first.body.total,3);assert.ok(first.body.nextCursor);
 const second=await request(app).get(`/api/orders?limit=2&after=${first.body.nextCursor}`);assert.equal(second.body.orders.length,1);assert.equal(second.body.nextCursor,null);
 assert.equal(new Set([...first.body.orders,...second.body.orders].map(order=>order.id)).size,3);
 assert.equal((await request(app).get('/api/orders?limit=101')).status,400);assert.equal((await request(app).get('/api/orders?after=missing')).status,400);
});


test("order filters combine status and normalized demo customer search", async () => {
 const app=createApp();const first=await checkout(app,'filter-one',{...body,customerName:'Morgan Demo'});await checkout(app,'filter-two',{...body,customerName:'Alex Demo'});
 await request(app).patch(`/api/orders/${first.body.order.id}`).send({status:'fulfilled'});
 const result=await request(app).get('/api/orders?status=fulfilled&q=%20MORGAN%20');assert.equal(result.body.total,1);assert.equal(result.body.orders[0].id,first.body.order.id);
 assert.equal((await request(app).get('/api/orders?status=unknown')).status,400);assert.equal((await request(app).get('/api/orders?q[x]=bad')).status,400);
});


test("store statistics remain global and distinguish cancelled value", async () => {
 const app=createApp();const cancelled=await checkout(app,'stats-cancel');await checkout(app,'stats-active');await request(app).patch(`/api/orders/${cancelled.body.order.id}`).send({status:'cancelled'});
 const stats=await request(app).get('/api/stats');assert.equal(stats.status,200);assert.equal(stats.body.orders,2);assert.deepEqual(stats.body.byStatus,{placed:1,fulfilled:0,cancelled:1});assert.equal(stats.body.activeTotalCents,5400);assert.equal(stats.body.stockUnits,65);
 await request(app).get('/api/orders?limit=1&status=placed');assert.equal((await request(app).get('/api/stats')).body.orders,2);
});


test("inventory stocktakes require a matching revision and reject stale concurrent counts", async () => {
 const app=createApp();const count=(stock:number,tag?:string)=>{const req=request(app).patch('/api/inventory/notebook/count').send({stock,reason:'Physical demo count'});return tag?req.set('If-Match',tag):req;};
 assert.equal((await count(20)).status,428);
 const results=await Promise.all([count(20,'"inventory-0"'),count(30,'"inventory-0"')]);assert.deepEqual(results.map(result=>result.status).sort(),[200,412]);
 assert.equal((await request(app).get('/api/products')).body.products[0].stock,20);
 assert.equal((await count(-1,'"inventory-1"')).status,400);
});


test("bounded store capacity preserves inventory and existing replay receipts", async () => {
 const app=createApp({maxOrders:1});const first=await checkout(app,'capacity-first');assert.equal(first.status,201);
 const second=await checkout(app,'capacity-second');assert.equal(second.status,503);assert.equal(second.body.code,'STORE_CAPACITY');
 assert.equal((await checkout(app,'capacity-first')).status,200);assert.equal((await request(app).get('/api/products')).body.products[0].stock,10);
 assert.throws(()=>createApp({maxOrders:0}),RangeError);
});


test("order version preconditions reject stale changes and allow equivalent repeats", async () => {
 const app=createApp();const first=await checkout(app,'version-order');assert.equal(first.body.order.version,1);const url=`/api/orders/${first.body.order.id}`;
 assert.equal((await request(app).get(url)).headers.etag,'"order-1"');
 assert.equal((await request(app).patch(url).set('If-Match','"order-0"').send({status:'fulfilled'})).status,412);
 const fulfilled=await request(app).patch(url).set('If-Match','"order-1"').send({status:'fulfilled'});assert.equal(fulfilled.body.order.version,2);
 const replay=await request(app).patch(url).set('If-Match','"order-1"').send({status:'fulfilled'});assert.equal(replay.status,200);assert.equal(replay.body.order.version,2);
});


test("audit trail records accepted operations once and bounds retention", async () => {
 const app=createApp({maxAuditEvents:3});const first=await checkout(app,'audit-trail');const url=`/api/orders/${first.body.order.id}`;
 await checkout(app,'audit-trail');await request(app).patch(url).send({status:'fulfilled'});await request(app).patch(url).send({status:'fulfilled'});
 await request(app).patch('/api/inventory/notebook').send({delta:2,reason:'Recount'});
 const events=(await request(app).get('/api/audit')).body.events;
 assert.deepEqual(events.map((event:{type:string})=>event.type),['stock_adjusted','order_fulfilled','order_placed']);
 assert.equal(JSON.stringify(events).includes('Alex Demo'),false);assert.equal(JSON.stringify(events).includes('audit-trail'),false);
 await request(app).patch('/api/inventory/notebook/count').set('If-Match','"inventory-2"').send({stock:8,reason:'Count'});
 assert.equal((await request(app).get('/api/audit')).body.events.length,3);
});


test("CSV export quotes values and neutralizes spreadsheet formulas", async () => {
 const app=createApp();await checkout(app,'csv-formula',{...body,customerName:'=1+1'});await checkout(app,'csv-quotes',{...body,customerName:'A, "B"'});
 const csv=await request(app).get('/api/orders/export.csv');assert.equal(csv.status,200);assert.match(csv.headers['content-type'],/text\/csv/);assert.match(csv.headers['content-disposition'],/attachment/);
 assert.ok(csv.text.includes('"\'=1+1"'));assert.ok(csv.text.includes('"A, ""B"""'));assert.equal(csv.text.split('\r\n').filter(Boolean).length,3);
});


test("HTTP fixtures isolate application state behind one bounded listener", async () => {
 const first=createApp();const second=createApp();await checkout(first,'fixture-isolation');
 const firstResult=await request(first).get('/api/orders');const secondResult=await request(second).get('/api/orders');
 assert.equal(firstResult.body.total,1);assert.equal(secondResult.body.total,0);
 assert.equal(new URL(firstResult.request.url).origin,new URL(secondResult.request.url).origin);
});

test('optional admin capability protects all administrative reads and writes without leaking the token',async()=>{
 const token='local-admin-capability-123';const app=createApp({adminToken:token});
 for(const path of ['/api/orders','/api/stats','/api/audit','/api/orders/export.csv']){const response=await request(app).get(path+'?token='+token);assert.equal(response.status,401);assert.equal(JSON.stringify(response.body).includes(token),false);}
 assert.equal((await request(app).patch('/api/inventory/notebook').send({delta:1,reason:'unauthorized'})).status,401);
 assert.equal((await request(app).get('/api/orders').set('Authorization','Bearer '+token)).status,200);
 assert.equal((await request(app).get('/api/products')).status,200);assert.equal((await checkout(app,'capability-public-checkout')).status,201);
 assert.throws(()=>createApp({adminToken:'short'}),/capability/);
});
