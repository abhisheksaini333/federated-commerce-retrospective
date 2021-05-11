import assert from 'node:assert/strict';import {test} from 'node:test';import * as catalog from '../../apps/catalog/search';import {seedProducts} from '../../apps/api/catalog';
test('catalog search normalizes Unicode and whitespace without changing product text',()=>{
 assert.equal(catalog.searchText('  CAFÉ  au\t lait '),catalog.searchText('cafe\u0301 au lait'));
 assert.equal(catalog.matchesSearch(seedProducts[0],'  EVERYDAY   notebook '),true);
});
