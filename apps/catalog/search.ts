import type {Product} from '../../packages/contracts';
export const searchText=(value:string)=>value.normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('en-US');
export const matchesSearch=(product:Product,search:string)=>searchText(`${product.name} ${product.description} ${product.category}`).includes(searchText(search));

export type SortOrder='featured'|'price-low'|'price-high'|'name';
export function sortProducts(products:readonly Product[],order:SortOrder):Product[]{
 if(order==='featured')return [...products];
 return [...products].sort((a,b)=>(order==='name'?a.name.localeCompare(b.name,'en'):order==='price-low'?a.priceCents-b.priceCents:b.priceCents-a.priceCents)||a.id.localeCompare(b.id,'en'));
}
