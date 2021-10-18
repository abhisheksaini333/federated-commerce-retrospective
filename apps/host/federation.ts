import type {ComponentType} from 'react';import {remoteConfiguration,RemoteName} from './federation-config';
declare const __webpack_init_sharing__:(scope:string)=>Promise<void>;
declare const __webpack_share_scopes__:Record<string,unknown>;
interface Container {init:(scope:unknown)=>Promise<void>|void;get:(name:string)=>Promise<()=>unknown>}
declare global {interface Window {FIELDWORK_CONFIG?:unknown}}
const containers=new Map<RemoteName,Promise<Container>>();const initialized=new WeakMap<Container,Promise<void>>();
function container(name:RemoteName):Promise<Container>{
 const existing=containers.get(name);if(existing)return existing;
 const result=new Promise<Container>((resolve,reject)=>{
  const src=remoteConfiguration(window.FIELDWORK_CONFIG)[name];const script=document.createElement('script');script.src=src;script.async=true;
  const timer=setTimeout(()=>fail(),5000);function fail(){clearTimeout(timer);script.remove();reject(Error('The remote display could not load.'));}
  script.onerror=fail;script.onload=()=>{clearTimeout(timer);const value=(window as unknown as Record<string,Container>)[name];if(!value||typeof value.get!=='function'||typeof value.init!=='function'){fail();return;}resolve(value);};document.head.appendChild(script);
 });containers.set(name,result);result.catch(()=>containers.delete(name));return result;
}
export async function loadFederated<P>(name:RemoteName,module:string):Promise<{default:ComponentType<P>}>{
 await __webpack_init_sharing__('default');const remote=await container(name);let ready=initialized.get(remote);
 if(!ready){ready=Promise.resolve().then(()=>remote.init(__webpack_share_scopes__.default));initialized.set(remote,ready);ready.catch(()=>initialized.delete(remote));}
 await ready;return (await remote.get(module))() as {default:ComponentType<P>};
}
