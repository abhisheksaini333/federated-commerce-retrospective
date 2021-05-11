import type {Product} from '../../packages/contracts';
export const searchText=(value:string)=>value.normalize('NFC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('en-US');
export const matchesSearch=(product:Product,search:string)=>searchText(`${product.name} ${product.description}`).includes(searchText(search));
