import assert from 'node:assert/strict';import {test} from 'node:test';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import Cart from '../../apps/cart/Cart';import {seedProducts} from '../../apps/api/catalog';
const noop=()=>{};
test('cart stock bounds quantity options and disables invalid checkout',()=>{
 const html=renderToStaticMarkup(React.createElement(Cart,{products:seedProducts.map(p=>({...p,stock:2})),items:[{productId:'notebook',quantity:3}],onQuantity:noop,onCheckout:noop}));
 assert.ok(!html.includes('<option value="4"'));assert.match(html,/disabled=""[^>]*>Continue to checkout/);assert.match(html,/Only 2 left/);
});
