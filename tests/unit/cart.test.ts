import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeCart} from '../../packages/cart';
import {seedProducts} from '../../apps/api/catalog';
test('saved cart normalization bounds duplicates and rejects unknown versions or products',()=>{
 assert.deepEqual(normalizeCart([{productId:'notebook',quantity:9},{productId:'notebook',quantity:9},{productId:'missing',quantity:1},{productId:'pencil',quantity:-1}],seedProducts),[{productId:'notebook',quantity:10}]);
 assert.deepEqual(normalizeCart({version:2,items:[{productId:'notebook',quantity:1}]}),[]);
 assert.deepEqual(normalizeCart({version:1,items:[{productId:'notebook',quantity:1}]}),[{productId:'notebook',quantity:1}]);
});
