import type { CheckoutRequest } from './index';
export interface ValidationIssue { path: string; message: string }
export type CheckoutValidation = { ok: true; value: CheckoutRequest } | { ok: false; issues: ValidationIssue[] };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateCheckout(value: unknown, productIds: readonly string[]): CheckoutValidation {
 const issues: ValidationIssue[]=[];
 const issue=(path:string,message:string)=>issues.push({path,message});
 if(!record(value)) return {ok:false,issues:[{path:'$',message:'Expected an object.'}]};
 for(const key of Object.keys(value)) if(!['items','customerName','shipping'].includes(key)) issue(key,'Unknown field.');
 if(typeof value.customerName!=='string'||!value.customerName.trim()||value.customerName.length>60) issue('customerName','Enter a demo name of 1–60 characters.');
 if(value.shipping!=='standard'&&value.shipping!=='express') issue('shipping','Choose standard or express delivery.');
 const items: CheckoutRequest['items']=[]; const seen=new Set<string>();
 if(!Array.isArray(value.items)||value.items.length<1||value.items.length>6) issue('items','Choose 1–6 unique product lines.');
 else value.items.forEach((item:unknown,index:number)=>{
  const prefix=`items.${index}`;
  if(!record(item)){issue(prefix,'Expected a product line.');return;}
  for(const key of Object.keys(item)) if(!['productId','quantity'].includes(key)) issue(`${prefix}.${key}`,'Unknown field.');
  if(typeof item.productId!=='string'||!productIds.includes(item.productId)) issue(`${prefix}.productId`,'Choose an available product.');
  else if(seen.has(item.productId)) issue(`${prefix}.productId`,'Duplicate product line.');
  else seen.add(item.productId);
  if(typeof item.quantity!=='number'||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10) issue(`${prefix}.quantity`,'Choose a whole quantity from 1 to 10.');
  items.push({productId:item.productId as string,quantity:item.quantity as number});
 });
 if(issues.length) return {ok:false,issues};
 return {ok:true,value:{items:items.sort((a,b)=>a.productId.localeCompare(b.productId)),customerName:(value.customerName as string).trim(),shipping:value.shipping as CheckoutRequest['shipping']}};
}
