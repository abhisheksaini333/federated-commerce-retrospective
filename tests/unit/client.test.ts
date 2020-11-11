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
