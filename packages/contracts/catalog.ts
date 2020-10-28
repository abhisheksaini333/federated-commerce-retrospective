import type { Product } from './index';
export function validateCatalog(products: readonly Product[]): void {
 if(!Array.isArray(products)||products.length>1000) throw new Error('Invalid catalog collection.');
 const ids=new Set<string>();
 for(const product of products){
  if(!product||typeof product.id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(product.id)||ids.has(product.id)) throw new Error('Invalid catalog product identifier.');
  if(typeof product.name!=='string'||!product.name.trim()||product.name.length>100||typeof product.description!=='string'||product.description.length>1000) throw new Error('Invalid catalog product description.');
  if(!Number.isSafeInteger(product.priceCents)||product.priceCents<0||product.priceCents>Math.floor(Number.MAX_SAFE_INTEGER/60)||!Number.isSafeInteger(product.stock)||product.stock<0) throw new Error('Invalid catalog money or stock.');
  if(!['Desk','Carry','Tools'].includes(product.category)||!['notebook','pencil','tote','bottle','lamp','tray'].includes(product.artwork)||typeof product.color!=='string'||!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(product.color)) throw new Error('Invalid catalog display metadata.');
  ids.add(product.id);
 }
}
