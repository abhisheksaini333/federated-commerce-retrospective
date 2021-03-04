import type {CartItem,Product} from '../contracts';
export function normalizeCart(value:unknown,products?:readonly Product[]):CartItem[]{
 const rows=Array.isArray(value)?value:value&&typeof value==='object'&&(value as {version?:unknown}).version===1?(value as {items?:unknown}).items:[];
 if(!Array.isArray(rows))return [];
 const quantities=new Map<string,number>();
 for(const row of rows.slice(0,100)){
  if(!row||typeof row!=='object'||typeof row.productId!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(row.productId)||!Number.isInteger(row.quantity)||row.quantity<1||row.quantity>10)continue;
  if(products&&!products.some(product=>product.id===row.productId))continue;
  quantities.set(row.productId,Math.min(10,(quantities.get(row.productId)??0)+row.quantity));
 }
 return [...quantities].sort(([a],[b])=>a.localeCompare(b)).slice(0,6).map(([productId,quantity])=>({productId,quantity}));
}
export const serializeCart=(items:readonly CartItem[])=>JSON.stringify({version:1,items});
