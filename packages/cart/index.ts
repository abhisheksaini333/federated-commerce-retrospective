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

export type CartAction={type:'add';productId:string}|{type:'quantity';productId:string;quantity:number}|{type:'clear'};
export function updateCart(previous:readonly CartItem[],action:CartAction,products:readonly Product[]):CartItem[]{
 const current=normalizeCart(previous,products);
 if(action.type==='clear')return [];
 const product=products.find(p=>p.id===action.productId);if(!product)return current;
 const existing=current.find(item=>item.productId===product.id);
 const quantity=action.type==='add'?(existing?.quantity??0)+1:action.quantity;
 if(!Number.isInteger(quantity)||quantity<0||quantity>Math.min(10,product.stock))return current;
 if(quantity===0)return current.filter(item=>item.productId!==product.id);
 if(!existing&&current.length>=6)return current;
 return normalizeCart([...current.filter(item=>item.productId!==product.id),{productId:product.id,quantity}],products);
}

export interface RemovedLine {item:CartItem;expiresAt:number}
export function restoreRemoved(items:readonly CartItem[],removed:RemovedLine,products:readonly Product[],now:number):CartItem[]{
 if(now>removed.expiresAt||items.some(item=>item.productId===removed.item.productId))return [...items];
 const stock=products.find(p=>p.id===removed.item.productId)?.stock??0;
 return updateCart(items,{type:'quantity',productId:removed.item.productId,quantity:Math.min(stock,removed.item.quantity)},products);
}
