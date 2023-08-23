import { validateCatalog } from './catalog';
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const cents=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
export function validOrder(value:unknown):boolean {
 if(!record(value)||!Number.isSafeInteger(value.version)||(value.version as number)<1||typeof value.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value.id)||typeof value.customerName!=='string'||!value.customerName.trim()||value.customerName.length>60||/[\u0000-\u001f\u007f-\u009f]/.test(value.customerName)||!['standard','express'].includes(value.shipping as string)||!['placed','fulfilled','cancelled'].includes(value.status as string)||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt)))return false;
 if(!Array.isArray(value.items)||!value.items.length||value.items.length>6||!cents(value.subtotalCents)||!cents(value.shippingCents)||!cents(value.totalCents))return false;
 let total=0;const ids=new Set<string>();
 for(const line of value.items){if(!record(line)||typeof line.productId!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(line.productId)||ids.has(line.productId)||typeof line.name!=='string'||!line.name.trim()||line.name.length>100||/[\u0000-\u001f\u007f-\u009f]/.test(line.name)||!cents(line.unitPriceCents)||typeof line.quantity!=='number'||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>10)return false;ids.add(line.productId);total+=(line.unitPriceCents as number)*line.quantity;}
 return total===value.subtotalCents&&Number.isSafeInteger(total)&&total+(value.shippingCents as number)===value.totalCents;
}
export function validApiResponse(url:string,value:unknown):boolean {
 const path=new URL(url,'http://local.invalid').pathname;
 if(path==='/api/checkout/quote')return record(value)&&record(value.quote)&&cents(value.quote.revision)&&validOrder({...value.quote,id:'quote',version:1,customerName:'Quote',shipping:'standard',status:'placed',createdAt:'1970-01-01T00:00:00Z'});
 if(path==='/api/session')return record(value)&&typeof value.adminProtected==='boolean';
 if(path==='/api/products'){if(!record(value)||!Array.isArray(value.products)||!cents(value.revision))return false;try{validateCatalog(value.products);return true;}catch{return false;}}
 if(path==='/api/checkout/resolve')return record(value)&&(value.status==='unknown'||value.status==='accepted'&&validOrder(value.order));
 if(/^\/api\/inventory\/[^/]+(?:\/count)?$/.test(path)){if(!record(value)||!cents(value.revision))return false;try{validateCatalog([value.product]);return true;}catch{return false;}}
 if(path==='/api/audit')return record(value)&&Array.isArray(value.events)&&value.events.length<=10000&&value.events.every(event=>record(event)&&cents(event.sequence)&&typeof event.type==='string'&&typeof event.subjectId==='string'&&typeof event.at==='string'&&Number.isFinite(Date.parse(event.at))&&record(event.details));
 if(path==='/api/stats')return record(value)&&cents(value.orders)&&cents(value.activeTotalCents)&&cents(value.stockUnits)&&cents(value.revision)&&record(value.byStatus)&&['placed','fulfilled','cancelled'].every(key=>cents((value.byStatus as Record<string,unknown>)[key]))&&Object.values(value.byStatus).reduce<number>((sum,count)=>sum+(typeof count==='number'?count:NaN),0)===value.orders;
 if(path==='/api/orders')return record(value)&&Array.isArray(value.orders)&&value.orders.every(validOrder)&&cents(value.total)&&(value.total as number)>=value.orders.length&&(value.nextCursor===null||typeof value.nextCursor==='string'&&value.nextCursor.length>0);
 if(path==='/api/checkout'||/^\/api\/orders\/[^/]+$/.test(path))return record(value)&&validOrder(value.order);
 return true;
}
