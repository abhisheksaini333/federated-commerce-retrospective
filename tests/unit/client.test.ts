import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { api } from '../../apps/host/api';
const originalFetch = globalThis.fetch;
Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
afterEach(() => { globalThis.fetch = originalFetch; });
test('HTTP failures preserve machine-readable status and domain code', async () => {
 globalThis.fetch = async () => new Response(JSON.stringify({code:'OUT_OF_STOCK',error:'Stock changed.',issues:[{path:'items.0.quantity',message:'Only one left.'}]}),{status:409,headers:{'Content-Type':'application/json'}});
 await assert.rejects(api('/api/checkout'), (error:unknown) => { const value=error as Error & {status:number;code:string;issues:{path:string}[]}; assert.equal(value.status,409);assert.equal(value.code,'OUT_OF_STOCK');assert.equal(value.issues[0].path,'items.0.quantity');return true;});
});


test('non-JSON and malformed responses use safe protocol errors', async () => {
 for(const response of [new Response('<h1>proxy secret</h1>',{status:502,headers:{'Content-Type':'text/html'}}),new Response('{broken',{headers:{'Content-Type':'application/json'}})]){
  globalThis.fetch=async()=>response;
  await assert.rejects(api('/api/products'),(error:unknown)=>{const value=error as Error&{code:string};assert.equal(value.code,'INVALID_RESPONSE');assert.equal(value.message.includes('proxy secret'),false);return true;});
 }
 globalThis.fetch=async()=>new Response(null,{status:204});
 assert.equal(await api<void>('/api/empty'),undefined);
});


test('caller cancellation and deadlines abort fetch without leaking cancellation state', async () => {
 globalThis.fetch=async(_url,options)=>new Promise<Response>((_resolve,reject)=>{options?.signal?.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true});});
 const controller=new AbortController();const pending=api('/api/products',{signal:controller.signal});controller.abort();
 await assert.rejects(pending,(error:unknown)=>(error as {code:string}).code==='REQUEST_CANCELLED');
 await assert.rejects(api('/api/products',{timeoutMs:5}),(error:unknown)=>(error as {code:string}).code==='REQUEST_TIMEOUT');
 let called=false;globalThis.fetch=async()=>{called=true;return new Response('{}',{headers:{'Content-Type':'application/json'}});};
 await assert.rejects(api('/api/products',{signal:controller.signal}));assert.equal(called,false);
});


test('request headers honor Headers objects and tuples without forcing GET content types', async () => {
 const observed:Headers[]=[];globalThis.fetch=async(_url,options)=>{observed.push(new Headers(options?.headers));return new Response('{}',{headers:{'Content-Type':'application/json'}});};
 await api('/api/custom',{headers:new Headers({'X-Request-Id':'request-one'})});
 await api('/api/custom',{headers:[['X-Request-Id','request-two']]});
 await api('/api/custom',{method:'POST',body:'plain',headers:{'Content-Type':'text/plain'}});
 assert.equal(observed[0].get('X-Request-Id'),'request-one');assert.equal(observed[1].get('X-Request-Id'),'request-two');assert.equal(observed[0].has('Content-Type'),false);assert.equal(observed[2].get('Content-Type'),'text/plain');
});


test('successful but invalid service payloads fail at the HTTP boundary', async () => {
 for(const [url,payload] of [['/api/products',{products:'not-an-array'}],['/api/orders',{orders:[{id:'broken'}]}],['/api/checkout',{order:{totalCents:-1}}]] as const){
  globalThis.fetch=async()=>new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json'}});
  await assert.rejects(api(url),(error:unknown)=>(error as {code:string}).code==='INVALID_RESPONSE');
 }
 globalThis.fetch=async()=>new Response(JSON.stringify({products:[],revision:0}),{headers:{'Content-Type':'application/json'}});
 assert.deepEqual(await api('/api/products'),{products:[],revision:0});
});

test('operational response envelopes validate receipt state revisions pagination and version tokens',async()=>{
 const malformed:[string,unknown][]=[['/api/checkout/resolve',{status:'accepted',order:{}}],['/api/checkout/resolve',{status:'maybe'}],['/api/products',{products:[],revision:-1}],['/api/orders',{orders:[],total:0,nextCursor:42}],['/api/inventory/notebook/count',{product:{id:'notebook'},revision:0}]];
 for(const [url,value] of malformed){globalThis.fetch=async()=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});await assert.rejects(api(url),(error:unknown)=>(error as {code:string}).code==='INVALID_RESPONSE');}
 globalThis.fetch=async()=>new Response(JSON.stringify({status:'unknown'}),{headers:{'Content-Type':'application/json'}});assert.deepEqual(await api('/api/checkout/resolve'),{status:'unknown'});
});
test('malformed server issue entries cannot crash field-level error recovery',async()=>{
 globalThis.fetch=async()=>new Response(JSON.stringify({error:'Rejected',issues:[null,42,{path:'customerName',message:'Fix name'},{path:3,message:[]}]}),{status:400,headers:{'Content-Type':'application/json'}});
 await assert.rejects(api('/api/checkout'),(error:unknown)=>{assert.deepEqual((error as {issues:unknown}).issues,[{path:'customerName',message:'Fix name'}]);return true;});
});

import {validOrder} from '../../packages/contracts/responses';
test('order responses require a positive integer version before conditional updates',()=>{
 const order={version:1,id:'test-order',customerName:'Demo',shipping:'standard',status:'placed',createdAt:new Date().toISOString(),items:[{productId:'notebook',quantity:1,name:'Notebook',unitPriceCents:2400}],subtotalCents:2400,shippingCents:600,totalCents:3000};assert.equal(validOrder(order),true);for(const version of [undefined,0,1.5])assert.equal(validOrder({...order,version}),false);
});
