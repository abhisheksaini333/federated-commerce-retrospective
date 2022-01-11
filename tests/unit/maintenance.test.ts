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
