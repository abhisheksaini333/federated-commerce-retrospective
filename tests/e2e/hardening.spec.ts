import {test,expect} from '@playwright/test';

test('saved carts reconcile duplicate unknown and malformed lines',async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('fieldwork:view','bag');sessionStorage.setItem('fieldwork:bag',JSON.stringify([{productId:'notebook',quantity:2},{productId:'notebook',quantity:3},{productId:'missing',quantity:2},{productId:'pencil',quantity:99}]));});
 await page.goto('/');await expect(page.getByRole('button',{name:'Bag (5)'})).toBeVisible();
 await expect(page.getByLabel('Quantity for Everyday notebook')).toHaveCount(1);await expect(page.getByLabel('Quantity for Everyday notebook')).toHaveValue('5');
});


test('stale durable checkout storage cannot replace a newer in-memory retry key',async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('fieldwork:checkout',JSON.stringify({fingerprint:'stale',key:'older-checkout'}));const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='fieldwork:checkout')throw new DOMException('quota','QuotaExceededError');original.call(this,key,value);};});
 const keys:string[]=[];await page.route('**/api/checkout',async route=>{keys.push(route.request().headers()['idempotency-key']);if(keys.length===1){await route.fetch();await route.abort('connectionfailed');}else await route.continue();});
 await page.goto('/');await page.getByRole('button',{name:'Add Everyday notebook'}).click();await page.getByRole('button',{name:'Bag (1)'}).click();await page.getByRole('button',{name:'Continue to checkout'}).click();await page.getByRole('button',{name:'Place demo order'}).click();await expect(page.getByRole('alert')).toBeVisible();await page.getByRole('button',{name:'Place demo order'}).click();await expect(page.getByRole('heading',{name:'A good day for good things.'})).toBeVisible();expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
});

test('checkout reference failure unlocks the form with recovery guidance',async({page})=>{
 await page.addInitScript(()=>{crypto.randomUUID=()=>{throw Error('unavailable');};});
 await page.goto('/');await page.getByRole('button',{name:'Add Everyday notebook'}).click();await page.getByRole('button',{name:'Bag (1)'}).click();await page.getByRole('button',{name:'Continue to checkout'}).click();await page.getByRole('button',{name:'Place demo order'}).click();
 await expect(page.getByRole('alert')).toContainText('secure checkout reference');await expect(page.getByRole('button',{name:'Place demo order'})).toBeEnabled();
});
