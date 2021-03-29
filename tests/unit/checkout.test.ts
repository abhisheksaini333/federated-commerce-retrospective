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
