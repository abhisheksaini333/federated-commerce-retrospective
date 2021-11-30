import {origin,RuntimeConfig} from './runtime-config';
export async function dependencyReadiness(config:RuntimeConfig,request:typeof fetch=fetch){
 const names=['api','catalog','cart'] as const;const results=await Promise.all(names.map(async name=>{try{const response=await request(origin(config,name)+(name==='api'?'/api/ready':'/remoteEntry.js'),{method:'HEAD',signal:AbortSignal.timeout(Math.min(config.apiTimeoutMs,1500))});await response.body?.cancel();return response.ok?'ready':'unavailable';}catch{return 'unavailable';}}));
 return {status:results.every(value=>value==='ready')?'ready':'degraded',dependencies:Object.fromEntries(names.map((name,index)=>[name,results[index]]))};
}
