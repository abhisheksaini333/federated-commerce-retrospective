import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as checkout from '../../apps/host/checkout';
const payload={items:[{productId:'notebook',quantity:1}],customerName:' Alex ',shipping:'standard' as const};
test('checkout keys are validated and canonical intent survives property order differences',()=>{
 const first=checkout.checkoutIntent(payload,null,()=> 'valid-key-123');
 const retry=checkout.checkoutIntent({...payload,customerName:'Alex'},JSON.stringify(first),()=>{throw Error('must reuse');});
 assert.equal(first.key,retry.key);
 assert.equal(checkout.checkoutIntent(payload,JSON.stringify({...first,key:'bad'}),()=> 'new-valid-key').key,'new-valid-key');
 assert.throws(()=>checkout.checkoutIntent(payload,null,()=>{throw Error('crypto unavailable');}),/secure checkout reference/);
});

test('draft restoration bounds saved fields and pending intent retains submitted payload',()=>{
 assert.deepEqual(checkout.readDraft('{"name":"Demo","shipping":"express"}'),{name:'Demo',shipping:'express'});
 assert.deepEqual(checkout.readDraft('{"name":42,"shipping":"bogus"}'),{name:'Alex Demo',shipping:'standard'});
 const intent=checkout.checkoutIntent(payload,null,()=> 'valid-key-123');
 assert.deepEqual(checkout.readPending(JSON.stringify(intent)),intent);
 assert.equal(checkout.readPending(JSON.stringify({...intent,payload:{...payload,items:[]}})),null);
});
