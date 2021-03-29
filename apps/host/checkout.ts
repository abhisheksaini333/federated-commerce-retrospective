import type {CheckoutRequest} from '../../packages/contracts';
import {validateCheckout} from '../../packages/contracts/validation';
export interface CheckoutIntent {key:string;fingerprint:string;payload:CheckoutRequest}
export function checkoutIntent(payload:CheckoutRequest,raw:string|null,newKey:()=>string):CheckoutIntent {
 const parsed=validateCheckout(payload,payload.items.map(item=>item.productId));
 if(!parsed.ok)throw new Error(parsed.issues[0].message);
 const fingerprint=JSON.stringify(parsed.value);
 let saved:Partial<CheckoutIntent>|null=null;
 try{saved=JSON.parse(raw||'null');}catch{/* Invalid storage starts a fresh intent. */}
 if(saved?.fingerprint===fingerprint&&typeof saved.key==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(saved.key))return {key:saved.key,fingerprint,payload:parsed.value};
 try{const key=newKey();if(!/^[A-Za-z0-9_-]{8,100}$/.test(key))throw Error();return {key,fingerprint,payload:parsed.value};}
 catch{throw new Error('A secure checkout reference could not be created. Reload and try again.');}
}
