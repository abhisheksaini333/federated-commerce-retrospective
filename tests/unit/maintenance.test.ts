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
