import {test,expect} from '@playwright/test';

test('saved carts reconcile duplicate unknown and malformed lines',async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('fieldwork:view','bag');sessionStorage.setItem('fieldwork:bag',JSON.stringify([{productId:'notebook',quantity:2},{productId:'notebook',quantity:3},{productId:'missing',quantity:2},{productId:'pencil',quantity:99}]));});
 await page.goto('/');await expect(page.getByRole('button',{name:'Bag (5)'})).toBeVisible();
 await expect(page.getByLabel('Quantity for Everyday notebook')).toHaveCount(1);await expect(page.getByLabel('Quantity for Everyday notebook')).toHaveValue('5');
});
