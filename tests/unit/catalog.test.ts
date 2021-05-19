import assert from 'node:assert/strict';import {test} from 'node:test';import * as catalog from '../../apps/catalog/search';import {seedProducts} from '../../apps/api/catalog';
test('catalog search normalizes Unicode and whitespace without changing product text',()=>{
 assert.equal(catalog.searchText('  CAFÉ  au\t lait '),catalog.searchText('cafe\u0301 au lait'));
 assert.equal(catalog.matchesSearch(seedProducts[0],'  EVERYDAY   notebook '),true);
});

test('catalog sorting has deterministic ties and never mutates source products',()=>{
 const input=[{...seedProducts[0],id:'b',name:'Zulu',priceCents:100},{...seedProducts[0],id:'a',name:'Alpha',priceCents:100}];
 assert.deepEqual(catalog.sortProducts(input,'price-low').map(p=>p.id),['a','b']);assert.deepEqual(input.map(p=>p.id),['b','a']);
 assert.deepEqual(catalog.sortProducts(input,'name').map(p=>p.name),['Alpha','Zulu']);
});
