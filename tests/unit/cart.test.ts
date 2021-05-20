import assert from 'node:assert/strict';
import {test} from 'node:test';
import {normalizeCart} from '../../packages/cart';
import {seedProducts} from '../../apps/api/catalog';
test('saved cart normalization bounds duplicates and rejects unknown versions or products',()=>{
 assert.deepEqual(normalizeCart([{productId:'notebook',quantity:9},{productId:'notebook',quantity:9},{productId:'missing',quantity:1},{productId:'pencil',quantity:-1}],seedProducts),[{productId:'notebook',quantity:10}]);
 assert.deepEqual(normalizeCart({version:2,items:[{productId:'notebook',quantity:1}]}),[]);
 assert.deepEqual(normalizeCart({version:1,items:[{productId:'notebook',quantity:1}]}),[{productId:'notebook',quantity:1}]);
});

import * as cart from '../../packages/cart';
test('cart actions use current quantities and atomically enforce stock limits',()=>{
 assert.equal(typeof cart.updateCart,'function');
 const products=seedProducts.map(p=>({...p,stock:3}));let state:any=[];
 for(let i=0;i<8;i++)state=cart.updateCart(state,{type:'add',productId:'notebook'},products);
 assert.deepEqual(state,[{productId:'notebook',quantity:3}]);
 assert.deepEqual(cart.updateCart(state,{type:'quantity',productId:'notebook',quantity:4},products),state);
 assert.deepEqual(cart.updateCart(state,{type:'quantity',productId:'notebook',quantity:1.5},products),state);
 assert.deepEqual(cart.updateCart(Object.freeze(state),{type:'quantity',productId:'notebook',quantity:0},products),[]);
 assert.deepEqual(cart.updateCart(state,{type:'clear'},products),[]);
});

test('undo removal expires and respects current stock without replacing newer quantities',()=>{
 const removed={item:{productId:'notebook',quantity:3},expiresAt:500};
 assert.deepEqual(cart.restoreRemoved([],removed,seedProducts,501),[]);
 assert.deepEqual(cart.restoreRemoved([],removed,seedProducts.map(p=>({...p,stock:2})),499),[{productId:'notebook',quantity:2}]);
 assert.deepEqual(cart.restoreRemoved([{productId:'notebook',quantity:1}],removed,seedProducts,499),[{productId:'notebook',quantity:1}]);
});
