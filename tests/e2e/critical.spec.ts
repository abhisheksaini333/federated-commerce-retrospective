import {test,expect} from '@playwright/test';
test('critical catalog to receipt journey has no uncaught browser errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await page.getByRole('button',{name:'Add Everyday notebook'}).click();await page.getByRole('button',{name:'Bag (1)'}).click();await page.getByRole('button',{name:'Continue to checkout'}).click();await page.getByLabel('Demo name').fill('Cross Browser Demo');await page.getByRole('button',{name:'Place demo order'}).click();await expect(page.getByTestId('order-id')).toContainText('FW-');await page.reload();await expect(page.getByRole('heading',{name:'A good day for good things.'})).toBeVisible();expect(errors).toEqual([]);
});
test('critical keyboard navigation reaches bag content and skip target',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Bag (0)'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Your everyday, upgraded.'})).toBeFocused();await page.getByRole('link',{name:'Skip to content'}).focus();await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();
});
