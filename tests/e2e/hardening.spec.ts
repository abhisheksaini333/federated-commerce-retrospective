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

test('checkout draft survives reload without losing delivery or name',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Add Everyday notebook'}).click();await page.getByRole('button',{name:'Bag (1)'}).click();await page.getByRole('button',{name:'Continue to checkout'}).click();await page.getByLabel('Demo name').fill('Draft Demo');await page.getByRole('radio',{name:/A little sooner/}).check();await page.reload();
 await expect(page.getByLabel('Demo name')).toHaveValue('Draft Demo');await expect(page.getByRole('radio',{name:/A little sooner/})).toBeChecked();await expect(page.getByRole('button',{name:'Bag (1)'})).toBeVisible();
});

test('lost checkout response locks edits until receipt resolution confirms the original order',async({page})=>{
 await page.route('**/api/checkout',async route=>{await route.fetch();await route.abort('connectionfailed');});
 await page.goto('/');await page.getByRole('button',{name:'Add Everyday notebook'}).click();await page.getByRole('button',{name:'Bag (1)'}).click();await page.getByRole('button',{name:'Continue to checkout'}).click();await page.getByRole('button',{name:'Place demo order'}).click();await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByRole('button',{name:'Shop',exact:true})).toBeDisabled();await expect(page.getByLabel('Demo name')).toBeDisabled();await page.getByRole('button',{name:'Check order status'}).click();await expect(page.getByRole('heading',{name:'A good day for good things.'})).toBeVisible();await expect(page.getByRole('button',{name:'Bag (0)'})).toBeEnabled();
});

test('confirmation reload preserves receipt without resubmitting checkout',async({page})=>{
 let submits=0;page.on('request',request=>{if(request.url().endsWith('/api/checkout'))submits++;});
 await page.goto('/');await page.getByRole('button',{name:'Add Everyday notebook'}).click();await page.getByRole('button',{name:'Bag (1)'}).click();await page.getByRole('button',{name:'Continue to checkout'}).click();await page.getByRole('button',{name:'Place demo order'}).click();const receipt=page.getByTestId('order-id');await expect(receipt).toBeVisible();const id=await receipt.textContent();await page.reload();await expect(receipt).toHaveText(id!);expect(submits).toBe(1);
});

test('collection filters survive bag navigation',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Desk',exact:true}).click();await page.getByRole('searchbox').fill('notebook');await page.getByRole('button',{name:'Bag (0)'}).click();await page.getByRole('button',{name:'Shop',exact:true}).click();await expect(page.getByRole('searchbox')).toHaveValue('notebook');await expect(page.getByRole('button',{name:'Desk',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('removed cart line can be undone with its quantity',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Add Everyday notebook'}).click();await page.getByRole('button',{name:'Bag (1)'}).click();await page.getByLabel('Quantity for Everyday notebook').selectOption('3');await page.getByRole('button',{name:'Remove Everyday notebook'}).click();await page.getByRole('button',{name:'Undo removal'}).click();await expect(page.getByLabel('Quantity for Everyday notebook')).toHaveValue('3');
});

test('empty bag confirmation preserves items on cancel and restores focus',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Add Everyday notebook'}).click();await page.getByRole('button',{name:'Bag (1)'}).click();await page.getByRole('button',{name:'Empty bag',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Keep my finds'}).click();await expect(page.getByRole('button',{name:'Empty bag',exact:true})).toBeFocused();await expect(page.getByRole('button',{name:'Bag (1)'})).toBeVisible();await page.getByRole('button',{name:'Empty bag',exact:true}).click();await page.getByRole('button',{name:'Yes, empty bag'}).click();await expect(page.getByRole('button',{name:'Bag (0)'})).toBeVisible();
});

test('admin keeps each pending order action disabled independently',async({page,request})=>{
 for(const name of ['Concurrent One','Concurrent Two'])await request.post('/api/checkout',{headers:{'Idempotency-Key':name.replace(/ /g,'-')},data:{items:[{productId:'pencil',quantity:1}],customerName:name,shipping:'standard'}});
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);let held=false;
 await page.route('**/api/orders/*',async route=>{if(!held&&route.request().method()==='PATCH'){held=true;await gate;}await route.continue();});
 await page.goto('/');await page.getByRole('button',{name:'Order desk',exact:true}).click();const first=page.getByRole('row').filter({hasText:'Concurrent One'});const second=page.getByRole('row').filter({hasText:'Concurrent Two'});
 try{await first.getByRole('button',{name:'Mark fulfilled'}).click();await second.getByRole('button',{name:'Mark fulfilled'}).click();await expect(second).toContainText('fulfilled');await expect(first.getByRole('button')).toBeDisabled();}finally{release();}
 await expect(first).toContainText('fulfilled');
});
