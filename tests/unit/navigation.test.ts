import assert from 'node:assert/strict';import {test} from 'node:test';import {routeView,viewUrl} from '../../apps/host/navigation';
test('view routes validate destinations and preserve unrelated query values',()=>{
 assert.equal(routeView('?view=bag'),'bag');assert.equal(routeView('?view=bogus'),null);assert.equal(viewUrl('http://local/?campaign=demo#collection','checkout'),'/?campaign=demo&view=checkout');
});
