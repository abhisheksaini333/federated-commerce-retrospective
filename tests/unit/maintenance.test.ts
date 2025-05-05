import assert from 'node:assert/strict';
import {test} from 'node:test';
import {restoreRemoved} from '../../packages/cart';
import {readDraft,checkoutIntent} from '../../apps/host/checkout';
import {validateCatalog} from '../../packages/contracts/catalog';
import {validApiResponse,validOrder} from '../../packages/contracts/responses';
import {seedProducts} from '../../apps/api/catalog';
import {createApp} from '../../apps/api/app';
import {request} from '../support/http';
const payload={items:[{productId:'notebook',quantity:1}],customerName:'Demo',shipping:'standard' as const};
const order={version:1,id:'test-order',customerName:'Demo',shipping:'standard',status:'placed',createdAt:'2021-01-01T00:00:00Z',items:[{productId:'notebook',quantity:1,name:'Notebook',unitPriceCents:2400}],subtotalCents:2400,shippingCents:600,totalCents:3000};

test('undo expires at its deadline and rejects invalid clocks',()=>{
 const removed={item:{productId:'notebook',quantity:1},expiresAt:100};
 assert.equal(restoreRemoved([],removed,seedProducts,99).length,1);
 for(const now of [100,NaN,Infinity])assert.deepEqual(restoreRemoved([],removed,seedProducts,now),[]);
 assert.deepEqual(restoreRemoved([],{...removed,expiresAt:NaN},seedProducts,1),[]);
});

test('persisted drafts reject invalid single-line customer names',()=>{
 for(const name of ['bad\nname','   ','bad\u0000'])assert.equal(readDraft(JSON.stringify({name,shipping:'standard'})).name,'Alex Demo');
 assert.equal(readDraft(JSON.stringify({name:'Café',shipping:'express'})).name,'Café');
});

test('oversized saved checkout intent cannot retain stale identity',()=>{
 const first=checkoutIntent(payload,null,()=> 'original-key');
 const raw=JSON.stringify({...first,padding:'x'.repeat(64000)});
 assert.equal(checkoutIntent(payload,raw,()=> 'fresh-key').key,'fresh-key');
});

test('catalog records must own their required fields',()=>{
 assert.throws(()=>validateCatalog([Object.create(seedProducts[0])]));
 const array=Object.assign([],seedProducts[0]);assert.throws(()=>validateCatalog([array]));
 validateCatalog(seedProducts);
});

test('catalog display text rejects controls while retaining ordinary prose',()=>{
 for(const extra of [{name:'Bad\u0000'},{description:'Bad\u0001'}])assert.throws(()=>validateCatalog([{...seedProducts[0],...extra}]));
 validateCatalog([{...seedProducts[0],description:'Line one\nLine two'}]);
});

test('session responses require an explicit protection boolean',()=>{
 assert.equal(validApiResponse('/api/session',{adminProtected:false}),true);
 for(const value of [{},{adminProtected:'false'},null])assert.equal(validApiResponse('/api/session',value),false);
});

test('checkout quote arithmetic and line identities are validated',()=>{
 const quote={revision:1,items:order.items,subtotalCents:2400,shippingCents:600,totalCents:3000};
 assert.equal(validApiResponse('/api/checkout/quote',{quote}),true);
 assert.equal(validApiResponse('/api/checkout/quote',{quote:{...quote,totalCents:1}}),false);
 assert.equal(validApiResponse('/api/checkout/quote',{quote:{...quote,items:[...order.items,...order.items]}}),false);
});

test('order response identities and customer display fields are bounded',()=>{
 for(const extra of [{customerName:''},{customerName:'bad\nname'},{id:'x'.repeat(129)}])assert.equal(validOrder({...order,...extra}),false);
 assert.equal(validOrder({...order,items:[{...order.items[0],productId:'bad/id'}]}),false);
 assert.equal(validOrder(order),true);
});

test('statistics responses reconcile counts and inventory metadata',()=>{
 const stats={orders:1,activeTotalCents:3000,stockUnits:20,revision:1,byStatus:{placed:1,fulfilled:0,cancelled:0}};
 assert.equal(validApiResponse('/api/stats',stats),true);
 for(const extra of [{orders:2},{stockUnits:-1},{revision:'1'}])assert.equal(validApiResponse('/api/stats',{...stats,...extra}),false);
});

test('order pages reject duplicate identities and invalid continuation cursors',()=>{
 assert.equal(validApiResponse('/api/orders',{orders:[order,order],total:2,nextCursor:null}),false);
 assert.equal(validApiResponse('/api/orders',{orders:[order],total:2,nextCursor:'unknown'}),false);
 assert.equal(validApiResponse('/api/orders',{orders:[order],total:2,nextCursor:order.id}),true);
});

test('audit response sequences are unique and newest first',()=>{
 const event={sequence:1,type:'created',subjectId:'order',at:'2021-01-01T00:00:00Z',details:{}};
 assert.equal(validApiResponse('/api/audit',{events:[event,event]}),false);
 assert.equal(validApiResponse('/api/audit',{events:[event,{...event,sequence:2}]}),false);
 assert.equal(validApiResponse('/api/audit',{events:[{...event,sequence:3},event]}),true);
});

test('misspelled order-list query filters are rejected',async()=>{
 const app=createApp();const invalid=await request(app).get('/api/orders?staus=placed');assert.equal(invalid.status,400);
 const valid=await request(app).get('/api/orders?status=placed&limit=10');assert.equal(valid.status,200);
});

test('inventory reasons reject control characters without changing stock',async()=>{
 const app=createApp();const before=await request(app).get('/api/products');
 assert.equal((await request(app).patch('/api/inventory/notebook').send({delta:1,reason:'bad\u0000'})).status,400);
 assert.equal((await request(app).patch('/api/inventory/notebook/count').set('If-Match','"inventory-0"').send({stock:1,reason:'bad\nreason'})).status,400);
 assert.deepEqual((await request(app).get('/api/products')).body,before.body);
});

test('inventory audit retains normalized operational reasons',async()=>{
 const app=createApp();await request(app).patch('/api/inventory/notebook').send({delta:1,reason:' Shelf audit '});
 const result=await request(app).get('/api/audit');assert.equal(result.body.events[0].details.reason,'Shelf audit');
});

test('inventory mutations return ETags for the next conditional update',async()=>{
 const app=createApp();const delta=await request(app).patch('/api/inventory/notebook').send({delta:1,reason:'Count'});
 assert.equal(delta.headers.etag,'"inventory-1"');
 const count=await request(app).patch('/api/inventory/notebook/count').set('If-Match',delta.headers.etag).send({stock:10,reason:'Recount'});
 assert.equal(count.status,200);assert.equal(count.headers.etag,'"inventory-2"');
});

test('status mutation and replay return the current order ETag',async()=>{
 const app=createApp();const created=await request(app).post('/api/checkout').set('Idempotency-Key','maintenance-order').send(payload);
 for(let i=0;i<2;i++){const changed=await request(app).patch(`/api/orders/${created.body.order.id}`).send({status:'fulfilled'});assert.equal(changed.headers.etag,'"order-2"');}
});
