export interface StringStore {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem?(key:string):void}
export function createSafeStorage(backend:()=>StringStore){
 const memory=new Map<string,string|null>();
 return {remove(key:string){memory.set(key,null);try{backend().removeItem?.(`fieldwork:${key}`);}catch{/* Keep the deletion authoritative for this page. */}},get(key:string){if(memory.has(key))return memory.get(key)!;try{return backend().getItem(`fieldwork:${key}`);}catch{return null;}},set(key:string,value:string){memory.set(key,value);try{backend().setItem(`fieldwork:${key}`,value);}catch{/* The in-memory write remains authoritative for this page. */}}};
}
export const storage=createSafeStorage(()=>sessionStorage);
