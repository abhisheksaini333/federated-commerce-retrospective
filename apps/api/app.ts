import {requestLogging,RequestLog,RequestMetrics} from './observability';
import { validateCatalog } from '../../packages/contracts/catalog';
import { validateCheckout } from '../../packages/contracts/validation';
import express, { type ErrorRequestHandler } from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
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
export interface AppOptions { ready?:()=>boolean; log?:(event:RequestLog)=>void; rateLimit?:{limit:number;windowMs:number}; adminToken?:string; maxAuditEvents?: number; maxOrders?: number; products?: readonly Product[]; now?: () => Date; idFactory?: () => string }

export function createApp(options: AppOptions = {}) {
  const rate=options.rateLimit??{limit:200,windowMs:60000};
  if(!Number.isInteger(rate.limit)||rate.limit<1||rate.limit>100000||!Number.isInteger(rate.windowMs)||rate.windowMs<1||rate.windowMs>3600000)throw new RangeError("Invalid mutation rate budget.");
  const budgets=new Map<string,{used:number;expiresAt:number}>();
  const adminToken=options.adminToken??process.env.COMMERCE_ADMIN_TOKEN;
  if(adminToken!==undefined&&!/^[A-Za-z0-9_-]{16,256}$/.test(adminToken))throw new RangeError("Admin capability must be 16–256 URL-safe characters.");
  const maxOrders=options.maxOrders??10000;
  if(!Number.isInteger(maxOrders)||maxOrders<1||maxOrders>1000000)throw new RangeError('Store capacity must be a positive bounded integer.');
  validateCatalog(options.products ?? seedProducts);
  const app = express();
  app.enable("case sensitive routing");
  const products = (options.products ?? seedProducts).map((product) => ({ ...product }));
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => `FW-${randomUUID().toUpperCase()}`);
  let inventoryRevision = 0;
  const auditLimit=options.maxAuditEvents??1000;
  if(!Number.isInteger(auditLimit)||auditLimit<1||auditLimit>10000)throw new RangeError('Invalid audit retention limit.');
  const events: {sequence:number;type:string;subjectId:string;at:string;details:Record<string,unknown>}[]=[];
  let eventSequence=0;
  const audit=(type:string,subjectId:string,details:Record<string,unknown>={})=>{events.push({sequence:++eventSequence,type,subjectId,at:now().toISOString(),details:structuredClone(details)});if(events.length>auditLimit)events.splice(0,events.length-auditLimit);};
  const orders = new Map<string, Order>();
  const receipts = new Map<string, { fingerprint: string; order: Order }>();
  app.disable("x-powered-by");
  const metrics=new RequestMetrics();
  app.use(requestLogging(options.log,metrics));
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use((req,res,next)=>{
    if(adminToken&&/^\/api\/(orders|inventory|stats|audit|metrics)(?:\/|$)/.test(req.path)){
      const authorization=req.get('Authorization')??'';const supplied=authorization.startsWith('Bearer ')?authorization.slice(7):'';
      if(Buffer.byteLength(supplied)!==Buffer.byteLength(adminToken)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(adminToken))){res.set('WWW-Authenticate','Bearer realm="Fieldwork order desk"').status(401).json({code:'ADMIN_REQUIRED',error:'Unlock the order desk with the local admin capability.'});return;}
    }next();
  });
  app.get('/api/session',(_req,res)=>res.json({adminProtected:!!adminToken}));
  app.use((req, res, next) => {
    if (['POST' , 'PATCH', 'PUT'].includes(req.method) && req.path.startsWith('/api/') && !req.is('application/json')) {
      res.status(415).json({ code: 'UNSUPPORTED_MEDIA_TYPE', error: 'Send this request as application/json.' }); return;
    }
    next();
  });
  app.use((req,res,next)=>{
    if(!['POST','PATCH','PUT','DELETE'].includes(req.method)||req.path==='/api/checkout/resolve'||req.path==='/api/checkout/quote'){next();return;}
    if(req.path==='/api/checkout'&&receipts.has(req.get('Idempotency-Key')??'')){next();return;}
    const time=now().getTime();for(const [key,budget] of budgets)if(budget.expiresAt<=time)budgets.delete(key);
    const key=`${req.socket.remoteAddress}:${req.path==='/api/checkout'?'checkout':'admin'}`;let budget=budgets.get(key);
    if(!budget){if(budgets.size>=2000){res.set('Retry-After','1').status(429).json({code:'RATE_LIMITED',error:'The demo is busy. Try again shortly.'});return;}budget={used:0,expiresAt:time+rate.windowMs};budgets.set(key,budget);}
    if(budget.used>=rate.limit){res.set('Retry-After',String(Math.max(1,Math.ceil((budget.expiresAt-time)/1000)))).status(429).json({code:'RATE_LIMITED',error:'Too many changes at once. Wait briefly and retry.'});return;}budget.used++;next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.get('/api/live',(_req,res)=>res.json({status:'alive'}));
  app.get('/api/ready',(_req,res)=>{let ready=false;try{ready=options.ready?.()??true;}catch{}res.status(ready?200:503).json({status:ready?'ready':'unavailable'});});
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", mode: "synthetic-local-demo" }),
  );
  app.get("/api/products", (_req, res) => res.set('ETag', `"inventory-${inventoryRevision}"`).json({ products, revision: inventoryRevision }));
  app.get('/api/metrics',(_req,res)=>res.json(metrics.snapshot()));
  app.get('/api/audit',(_req,res)=>res.json({events:[...events].reverse()}));
  app.get('/api/stats',(_req,res)=>{
    const values=[...orders.values()];
    res.json({orders:values.length,byStatus:{placed:values.filter(order=>order.status==='placed').length,fulfilled:values.filter(order=>order.status==='fulfilled').length,cancelled:values.filter(order=>order.status==='cancelled').length},activeTotalCents:values.filter(order=>order.status!=='cancelled').reduce((sum,order)=>sum+order.totalCents,0),stockUnits:products.reduce((sum,product)=>sum+product.stock,0),revision:inventoryRevision});
  });
  app.get('/api/orders',(req,res)=>{
    const rawLimit=req.query.limit;const after=req.query.after;
    const limit=rawLimit===undefined?25:typeof rawLimit==='string'&&/^[1-9][0-9]*$/.test(rawLimit)?Number(rawLimit):NaN;
    if(!Number.isInteger(limit)||limit>100||(after!==undefined&&(typeof after!=='string'||!after))){res.status(400).json({code:'INVALID_QUERY',error:'Use a limit from 1 to 100 and a valid cursor.'});return;}
    const status=req.query.status;const query=req.query.q;
    if((status!==undefined&&(typeof status!=='string'||!['placed','fulfilled','cancelled'].includes(status)))||(query!==undefined&&(typeof query!=='string'||query.length>60))){res.status(400).json({code:'INVALID_QUERY',error:'Use a known order status and a short customer search.'});return;}
    const normalized=typeof query==='string'?query.trim().normalize('NFC').toLocaleLowerCase('en-US'):'';
    const matches=[...orders.values()].reverse().filter(order=>(status===undefined||order.status===status)&&order.customerName.toLocaleLowerCase('en-US').includes(normalized));
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
    if(orders.size>=maxOrders){res.status(503).json({code:'STORE_CAPACITY',error:'This demo session reached its order limit. Existing orders and retries are still available.'});return;}
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
      version: 1,
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
    audit('order_placed',order.id,{totalCents:order.totalCents});
    res.status(201).json({ order, replayed: false });
  });
  app.patch('/api/inventory/:id/count',(req,res)=>{
    const product=products.find(value=>value.id===req.params.id);
    if(!product){res.status(404).json({code:'NOT_FOUND',error:'Product not found.'});return;}
    const expected=req.get('If-Match');
    if(!expected){res.status(428).json({code:'PRECONDITION_REQUIRED',error:'Read the current inventory before setting a count.'});return;}
    if(expected!==`"inventory-${inventoryRevision}"`){res.status(412).json({code:'PRECONDITION_FAILED',error:'Inventory changed. Refresh before applying this count.'});return;}
    if(!object(req.body)||!exactKeys(req.body,['stock','reason'])||!Number.isSafeInteger(req.body.stock)||(req.body.stock as number)<0||typeof req.body.reason!=='string'||!req.body.reason.trim()||req.body.reason.length>140){res.status(400).json({code:'INVALID_ADJUSTMENT',error:'Use a non-negative whole stock count and a short reason.'});return;}
    const priorStock=product.stock;product.stock=req.body.stock as number;inventoryRevision++;
    audit('inventory_counted',product.id,{from:priorStock,to:product.stock});
    res.json({product,revision:inventoryRevision});
  });
  app.patch('/api/inventory/:id',(req,res)=>{
    const product=products.find(value=>value.id===req.params.id);
    if(!product){res.status(404).json({code:'NOT_FOUND',error:'Product not found.'});return;}
    if(!object(req.body)||!exactKeys(req.body,['delta','reason'])||!Number.isInteger(req.body.delta)||req.body.delta===0||Math.abs(req.body.delta as number)>1000||typeof req.body.reason!=='string'||!req.body.reason.trim()||req.body.reason.length>140||product.stock+(req.body.delta as number)<0||!Number.isSafeInteger(product.stock+(req.body.delta as number))){res.status(400).json({code:'INVALID_ADJUSTMENT',error:'Use a nonzero whole adjustment up to 1000 units and a short reason without making stock negative.'});return;}
    product.stock+=req.body.delta as number;inventoryRevision++;
    audit('stock_adjusted',product.id,{delta:req.body.delta,stock:product.stock});
    res.json({product,revision:inventoryRevision});
  });
  app.get('/api/orders/export.csv',(_req,res)=>{
    const cell=(value:unknown)=>{let text=String(value);if(/^[=+\-@]/.test(text.trimStart()))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const rows=[['Order','Demo customer','Status','Total cents','Created at'],...[...orders.values()].map(order=>[order.id,order.customerName,order.status,order.totalCents,order.createdAt])];
    res.type('text/csv').set('Content-Disposition','attachment; filename="fieldwork-orders.csv"').send(rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n');
  });
  app.get('/api/orders/:id'  , (req,res) => {
    const order=orders.get(req.params.id);
    if(!order){res.status(404).json({code:'NOT_FOUND',error:'Order not found.'});return;}
    res.set('ETag', `"order-${order.version}"`).json({order});
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
    const expected=req.get('If-Match');
    if(order.status!==nextStatus&&expected&&expected!==`"order-${order.version}"`){res.status(412).json({code:'PRECONDITION_FAILED',error:'This order changed. Refresh before updating it.'});return;}
    if(order.status!==nextStatus&&order.status!=='placed'){res.status(409).json({code:'INVALID_TRANSITION',error:'Completed orders cannot change to another terminal status.'});return;}
    if(nextStatus==='cancelled'&&order.status==='placed'){
      for(const line of order.items) products.find(product=>product.id===line.productId)!.stock+=line.quantity;
      inventoryRevision++;
    }
    if(order.status!==nextStatus){order.version++;audit(nextStatus==='cancelled'?'order_cancelled':'order_fulfilled',order.id,{version:order.version});}
    order.status = nextStatus;
    res.json({ order });
  });
  const allowedMethods: [RegExp, string][] = [
    [/^\/api\/inventory\/[^/]+(?:\/count)?$/, 'PATCH'],
    [/^\/api\/(health|live|ready|products|orders|stats|audit|session|metrics)$/, 'GET, HEAD'],
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
