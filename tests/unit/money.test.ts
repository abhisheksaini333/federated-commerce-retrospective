import assert from 'node:assert/strict';
import { test } from 'node:test';
import {money,shippingCents} from '../../packages/contracts';
test('money helpers reject unsafe cents and retain exact large fractional amounts',()=>{
 for(const value of [-1,0.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {assert.throws(()=>money(value),RangeError);assert.throws(()=>shippingCents('standard',value),RangeError);}
 assert.equal(money(Number.MAX_SAFE_INTEGER),'$90,071,992,547,409.91');
 assert.equal(shippingCents('standard',7499),600);assert.equal(shippingCents('standard',7500),0);assert.equal(shippingCents('express',7500),1200);
 assert.throws(()=>shippingCents('invalid' as never,100),RangeError);
});
