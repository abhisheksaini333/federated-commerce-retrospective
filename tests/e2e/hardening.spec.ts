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
 try{await first.getByRole('button',{name:'Mark fulfilled'}).click();await second.getByRole('button',{name:'Mark fulfilled'}).click();await expect(second).toContainText('fulfilled');await expect(first.getByRole('button',{name:'Updating…'})).toBeDisabled();}finally{release();}
 await expect(first).toContainText('fulfilled');
});

test('view navigation announces its heading through focus and document title',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Bag (0)'}).click();await expect(page.getByRole('heading',{name:'Your everyday, upgraded.'})).toBeFocused();await expect(page).toHaveTitle('Your bag · Fieldwork Supply');await page.getByRole('button',{name:'Order desk',exact:true}).click();await expect(page.getByRole('heading',{name:'The order desk.'})).toBeFocused();await expect(page).toHaveTitle('Order desk · Fieldwork Supply');
});

test('skip link moves keyboard focus into the main content',async({page})=>{
 await page.goto('/');const skip=page.getByRole('link',{name:'Skip to content'});await skip.focus();await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();await page.getByRole('button',{name:'Bag (0)'}).click();await skip.focus();await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();
});

test('server field errors focus and describe the invalid checkout name',async({page})=>{
 await page.route('**/api/checkout',route=>route.fulfill({status:400,json:{code:'INVALID_CHECKOUT',error:'Check your demo name.',issues:[{path:'customerName',message:'Use a single-line name.'}]}}));
 await page.goto('/');await page.getByRole('button',{name:'Add Everyday notebook'}).click();await page.getByRole('button',{name:'Bag (1)'}).click();await page.getByRole('button',{name:'Continue to checkout'}).click();await page.getByRole('button',{name:'Place demo order'}).click();await expect(page.getByLabel('Demo name')).toHaveAttribute('aria-invalid','true');await expect(page.getByLabel('Demo name')).toBeFocused();await expect(page.getByLabel('Demo name')).toHaveAccessibleDescription('Use a single-line name.');await page.getByLabel('Demo name').fill('Fixed');await expect(page.getByLabel('Demo name')).not.toHaveAttribute('aria-invalid','true');
});

test('repeated cart changes update the live announcement and removal names the item',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Add Everyday notebook'}).click();const live=page.locator('.toast');const first=await live.textContent();await page.getByRole('button',{name:'Add Everyday notebook'}).click();await expect(live).not.toHaveText(first!);await page.getByRole('button',{name:'Bag (2)'}).click();await page.getByRole('button',{name:'Remove Everyday notebook'}).click();await expect(live).toContainText('Everyday notebook removed');
});

test('browser history restores views and supports direct order desk links',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Bag (0)'}).click();await page.getByRole('button',{name:'Shop',exact:true}).click();await page.goBack();await expect(page.getByRole('heading',{name:'Your everyday, upgraded.'})).toBeVisible();await page.goForward();await expect(page.getByRole('searchbox')).toBeVisible();await page.goto('/?view=admin');await expect(page.getByRole('heading',{name:'The order desk.'})).toBeVisible();
});

test('narrow layout keeps controls touchable and long receipt IDs inside the page',async({page})=>{
 await page.setViewportSize({width:320,height:800});await page.goto('/');const add=page.getByRole('button',{name:'Add Everyday notebook'});await expect(add).toBeVisible();const size=await add.boundingBox();expect(size!.height).toBeGreaterThanOrEqual(44);await add.click();await page.getByRole('button',{name:'Bag (1)'}).click();const quantity=await page.getByLabel('Quantity for Everyday notebook').boundingBox();expect(quantity!.height).toBeGreaterThanOrEqual(44);await page.getByRole('button',{name:'Continue to checkout'}).click();await page.getByRole('button',{name:'Place demo order'}).click();await expect(page.getByTestId('order-id')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('narrow order tables expose a named keyboard scroll region',async({page,request})=>{
 await request.post('/api/checkout',{headers:{'Idempotency-Key':'scroll-region-order'},data:{items:[{productId:'pencil',quantity:1}],customerName:'Scroll Demo',shipping:'standard'}});
 await page.setViewportSize({width:360,height:800});await page.goto('/?view=admin');const region=page.getByRole('region',{name:'Orders table; scroll horizontally for all columns'});await expect(region).toBeVisible();await region.focus();await expect(region).toBeFocused();await page.keyboard.press('ArrowRight');await expect.poll(()=>region.evaluate(element=>element.scrollLeft)).toBeGreaterThan(0);
});

test('forced colors retains explicit control boundaries and keyboard focus',async({page})=>{
 await page.emulateMedia({forcedColors:'active'});await page.goto('/');const button=page.getByRole('button',{name:'Add Everyday notebook'});await button.focus();await expect(button).toBeFocused();const styles=await button.evaluate(element=>{const s=getComputedStyle(element);return {border:s.borderTopWidth,outline:s.outlineStyle,outlineWidth:s.outlineWidth};});expect(parseFloat(styles.border)).toBeGreaterThanOrEqual(2);expect(styles.outline).not.toBe('none');expect(parseFloat(styles.outlineWidth)).toBeGreaterThanOrEqual(2);
});

test('order details require confirmation before cancellation and refresh the row',async({page,request})=>{
 const result=await request.post('/api/checkout',{headers:{'Idempotency-Key':'detail-cancel-order'},data:{items:[{productId:'pencil',quantity:1}],customerName:'Cancel Demo',shipping:'express'}});const {order}=await result.json();await page.goto('/?view=admin');await page.getByRole('button',{name:`View order ${order.id}`}).click();const detail=page.getByRole('region',{name:'Order details'});await expect(detail).toContainText('Express');await detail.getByRole('button',{name:'Cancel order',exact:true}).click();expect((await (await request.get(`/api/orders/${order.id}`)).json()).order.status).toBe('placed');await detail.getByRole('button',{name:'Confirm cancellation'}).click();await expect(page.getByRole('row').filter({hasText:'Cancel Demo'})).toContainText('cancelled');
});

test('order filters and cursor pages keep global totals visible',async({page,request})=>{
 const previous=(await (await request.get('/api/stats')).json()).orders;
 for(let i=0;i<6;i++)await request.post('/api/checkout',{headers:{'Idempotency-Key':`pagination-order-${i}`},data:{items:[{productId:'pencil',quantity:1}],customerName:`Page Demo ${i}`,shipping:'standard'}});
 await page.goto('/?view=admin');await page.getByLabel('Customer search').fill('Page Demo');await page.getByRole('button',{name:'Apply filters'}).click();await expect(page.getByRole('row')).toHaveCount(6);await expect(page.getByTestId('global-orders')).toHaveText(String(previous+6));await page.getByRole('button',{name:'Next page'}).click();await expect(page.getByRole('row')).toHaveCount(2);await expect(page.getByTestId('global-orders')).toHaveText(String(previous+6));await page.getByLabel('Customer search').fill('Page Demo 3');await page.getByRole('button',{name:'Apply filters'}).click();await expect(page.getByRole('row')).toHaveCount(2);await expect(page.getByRole('row').last()).toContainText('Page Demo 3');await expect(page.getByRole('button',{name:'Next page'})).toBeDisabled();
});
