import { validateCatalog } from '../../packages/contracts/catalog';
import { validateCheckout } from '../../packages/contracts/validation';
import express, { type ErrorRequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { seedProducts } from "./catalog";
import {
  shippingCents,
  type CheckoutRequest,
  type Order,
  type Product,
} from "../../packages/contracts";

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

/** One isolated in-memory store per app; synchronous mutation is atomic in one Node process. */
export interface AppOptions { products?: readonly Product[]; now?: () => Date; idFactory?: () => string }

export function createApp(options: AppOptions = {}) {
  validateCatalog(options.products ?? seedProducts);
  const app = express();
  const products = (options.products ?? seedProducts).map((product) => ({ ...product }));
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => `FW-${randomUUID().toUpperCase()}`);
  let inventoryRevision = 0;
  const orders = new Map<string, Order>();
  const receipts = new Map<string, { fingerprint: string; order: Order }>();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use((req, res, next) => {
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.path.startsWith('/api/') && !req.is('application/json')) {
      res.status(415).json({ code: 'UNSUPPORTED_MEDIA_TYPE', error: 'Send this request as application/json.' }); return;
    }
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", mode: "synthetic-local-demo" }),
  );
  app.get("/api/products", (_req, res) => res.set('ETag', `"inventory-${inventoryRevision}"`).json({ products, revision: inventoryRevision }));
  app.get('/api/orders',(req,res)=>{
    const rawLimit=req.query.limit;const after=req.query.after;
    const limit=rawLimit===undefined?25:typeof rawLimit==='string'&&/^[1-9][0-9]*$/.test(rawLimit)?Number(rawLimit):NaN;
    if(!Number.isInteger(limit)||limit>100||(after!==undefined&&(typeof after!=='string'||!after))){res.status(400).json({code:'INVALID_QUERY',error:'Use a limit from 1 to 100 and a valid cursor.'});return;}
    const matches=[...orders.values()].reverse();
    const offset=after===undefined?0:matches.findIndex(order=>order.id===after)+1;
    if(after!==undefined&&offset===0){res.status(400).json({code:'INVALID_CURSOR',error:'That order cursor is no longer available.'});return;}
    const page=matches.slice(offset,offset+limit);
    res.json({orders:page,total:matches.length,nextCursor:offset+page.length<matches.length?page[page.length-1]?.id??null:null});
  });
  app.post('/api/checkout/quote',(req,res)=>{
    const validation=validateCheckout(req.body,products.map(product=>product.id));
    if(!validation.ok){res.status(400).json({code:'INVALID_CHECKOUT',error:'Review the highlighted checkout fields.',issues:validation.issues});return;}
    const payload=validation.value;
    const lines=payload.items.map(item=>({...item,product:products.find(product=>product.id===item.productId)!}));
    if(lines.some(line=>line.quantity>line.product.stock)){res.status(409).json({code:'OUT_OF_STOCK',error:'Some requested items are no longer available.'});return;}
    const subtotalCents=lines.reduce((sum,line)=>sum+line.quantity*line.product.priceCents,0);
    const delivery=shippingCents(payload.shipping,subtotalCents);
    res.json({quote:{revision:inventoryRevision,items:lines.map(line=>({productId:line.productId,quantity:line.quantity,name:line.product.name,unitPriceCents:line.product.priceCents})),subtotalCents,shippingCents:delivery,totalCents:subtotalCents+delivery}});
  });
  app.post('/api/checkout/resolve' ,(req,res)=>{
    const validation=validateCheckout(req.body,products.map(product=>product.id));
    const key=req.get('Idempotency-Key');
    if(!validation.ok||!key||!/^[a-zA-Z0-9_-]{8,100}$/.test(key)){res.status(400).json({code:'INVALID_CHECKOUT',error:'A valid checkout intent and key are required.'});return;}
    const receipt=receipts.get(key);
    if(!receipt){res.json({status:'unknown'});return;}
    if(receipt.fingerprint!==JSON.stringify(validation.value)){res.status(409).json({code:'IDEMPOTENCY_CONFLICT',error:'This key belongs to a different checkout intent.'});return;}
    res.json({status:'accepted',order:orders.get(receipt.order.id)??receipt.order});
  });
  app.post("/api/checkout", (req, res) => {
    const key = req.get("Idempotency-Key");
    const validation = validateCheckout(req.body, products.map(product => product.id));
    const payload = validation.ok ? validation.value : null;
    if (!key || !/^[a-zA-Z0-9_-]{8,100}$/.test(key) || !payload) {
      res.status(400).json({
        code: "INVALID_CHECKOUT",
        issues: validation.ok ? [{ path: 'Idempotency-Key', message: 'Use a valid idempotency key.' }] : validation.issues,
        error:
          "Use a demo name, valid delivery option, and 1–10 of each item. A valid idempotency key is required.",
      });
      return;
    }
    const fingerprint = JSON.stringify(payload);
    const receipt = receipts.get(key);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        res.status(409).json({
          code: "IDEMPOTENCY_CONFLICT",
          error:
            "This checkout key belongs to a different order. Review the bag and start a new checkout.",
        });
      else res.json({ order: receipt.order, replayed: true });
      return;
    }
    const expectedRevision=req.get('If-Match');
    if(expectedRevision&&expectedRevision!==`"inventory-${inventoryRevision}"`){res.set('ETag',`"inventory-${inventoryRevision}"`).status(412).json({code:'PRECONDITION_FAILED',error:'Stock changed after this quote. Refresh the quote before placing the order.'});return;}
    const lines = payload.items.map((item) => ({
      item,
      product: products.find((p) => p.id === item.productId)!,
    }));
    if (lines.some(({ item, product }) => product.stock < item.quantity)) {
      res.status(409).json({
        code: "OUT_OF_STOCK",
        stockConflicts: lines.filter(({item,product})=>product.stock<item.quantity).map(({item,product})=>({productId:product.id,requested:item.quantity,available:product.stock})),
        error:
          "Stock changed. Refresh the catalog and adjust your bag before trying again.",
      });
      return;
    }
    // No await between validation and mutation: one process cannot interleave these writes.
    const subtotalCents = lines.reduce(
      (sum, { item, product }) => sum + item.quantity * product.priceCents,
      0,
    );
    const delivery = shippingCents(payload.shipping, subtotalCents);
    let id = idFactory();
    for (let attempt = 0; orders.has(id) && attempt < 4; attempt++) id = idFactory();
    if (!id || orders.has(id)) { res.status(503).json({code:'IDENTITY_UNAVAILABLE',error:'An order identifier could not be allocated. Try again.'}); return; }
    const order: Order = {
      id,
      customerName: payload.customerName,
      shipping: payload.shipping,
      items: lines.map(({ item, product }) => ({
        ...item,
        name: product.name,
        unitPriceCents: product.priceCents,
      })),
      subtotalCents,
      shippingCents: delivery,
      totalCents: subtotalCents + delivery,
      createdAt: now().toISOString(),
      status: "placed",
    };
    for (const { item, product } of lines) product.stock -= item.quantity;
    inventoryRevision++;
    orders.set(order.id, order);
    receipts.set(key, { fingerprint, order: structuredClone(order) });
    res.status(201).json({ order, replayed: false });
  });
  app.patch('/api/inventory/:id',(req,res)=>{
    const product=products.find(value=>value.id===req.params.id);
    if(!product){res.status(404).json({code:'NOT_FOUND',error:'Product not found.'});return;}
    if(!object(req.body)||!exactKeys(req.body,['delta','reason'])||!Number.isInteger(req.body.delta)||req.body.delta===0||Math.abs(req.body.delta as number)>1000||typeof req.body.reason!=='string'||!req.body.reason.trim()||req.body.reason.length>140||product.stock+(req.body.delta as number)<0||!Number.isSafeInteger(product.stock+(req.body.delta as number))){res.status(400).json({code:'INVALID_ADJUSTMENT',error:'Use a nonzero whole adjustment up to 1000 units and a short reason without making stock negative.'});return;}
    product.stock+=req.body.delta as number;inventoryRevision++;
    res.json({product,revision:inventoryRevision});
  });
  app.get('/api/orders/:id' , (req,res) => {
    const order=orders.get(req.params.id);
    if(!order){res.status(404).json({code:'NOT_FOUND',error:'Order not found.'});return;}
    res.json({order});
  });
  app.patch("/api/orders/:id", (req, res) => {
    if (
      !object(req.body) ||
      !exactKeys(req.body, ["status"]) ||
      !["fulfilled", "cancelled"].includes(req.body.status as string)
    ) {
      res.status(400).json({
        code: "INVALID_STATUS",
        error: "Choose fulfillment or cancellation.",
      });
      return;
    }
    const order = orders.get(req.params.id);
    if (!order) {
      res.status(404).json({ code: "NOT_FOUND", error: "Order not found." });
      return;
    }
    const nextStatus=req.body.status as 'fulfilled'|'cancelled';
    if(order.status!==nextStatus&&order.status!=='placed'){res.status(409).json({code:'INVALID_TRANSITION',error:'Completed orders cannot change to another terminal status.'});return;}
    if(nextStatus==='cancelled'&&order.status==='placed'){
      for(const line of order.items) products.find(product=>product.id===line.productId)!.stock+=line.quantity;
      inventoryRevision++;
    }
    order.status = nextStatus;
    res.json({ order });
  });
  const allowedMethods: [RegExp, string][] = [
    [/^\/api\/inventory\/[^/]+$/, 'PATCH'],
    [/^\/api\/(health|products|orders)$/, 'GET, HEAD'],
    [/^\/api\/checkout(?:\/(?:resolve|quote))?$/, 'POST'],
    [/^\/api\/orders\/[^/]+$/, 'GET, HEAD, PATCH'],
  ];
  app.use((req, res, next) => {
    const rule = allowedMethods.find(([pattern]) => pattern.test(req.path));
    if (!rule) { next(); return; }
    res.set('Allow', rule[1]).status(405).json({ code: 'METHOD_NOT_ALLOWED', error: 'This resource does not support that method.' });
  });
  app.use((_req, res) =>
    res.status(404).json({ code: "NOT_FOUND", error: "Route not found." }),
  );
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error.type === 'entity.too.large' ? 413 : error.status === 415 ? 415 : error instanceof URIError || (error.status >= 400 && error.status < 500) ? 400 : 500;
    const code = status === 413 ? 'BODY_TOO_LARGE' : status === 415 ? 'UNSUPPORTED_MEDIA_TYPE' : error.type === 'entity.parse.failed' ? 'INVALID_JSON' : status === 400 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR';
    res.status(status).json({ code, error: status === 500 ? 'The demo service encountered an error.' : status === 415 ? 'Use UTF-8 JSON for this request.' : 'Send a valid JSON request smaller than 16 KB.' });
  };
  app.use(errors);
  return app;
}
