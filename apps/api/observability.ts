import type {RequestHandler} from 'express';import {randomUUID} from 'node:crypto';import {performance} from 'node:perf_hooks';
export interface RequestLog {requestId:string;method:string;route:string;status:number;durationMs:number}
export class RequestMetrics {
 private state={requests:0,statusClasses:{'2xx':0,'4xx':0,'5xx':0,other:0},checkout:{created:0,replayed:0,rejected:0},latency:{sumMs:0,maxMs:0,buckets:{le10:0,le50:0,le250:0,le1000:0,gt1000:0}}};
 record(event:RequestLog){const state=this.state;state.requests++;const group=event.status>=500?'5xx':event.status>=400?'4xx':event.status>=200&&event.status<300?'2xx':'other';state.statusClasses[group]++;state.latency.sumMs+=event.durationMs;state.latency.maxMs=Math.max(state.latency.maxMs,event.durationMs);const bucket=event.durationMs<=10?'le10':event.durationMs<=50?'le50':event.durationMs<=250?'le250':event.durationMs<=1000?'le1000':'gt1000';state.latency.buckets[bucket]++;if(event.route==='/api/checkout'&&event.method==='POST')state.checkout[event.status===201?'created':event.status===200?'replayed':'rejected']++;}
 snapshot(){return structuredClone(this.state);}
}
export function requestLogging(log?:(event:RequestLog)=>void,metrics?:RequestMetrics):RequestHandler{
 return (req,res,next)=>{const supplied=req.get('X-Request-Id');const requestId=supplied&&/^[A-Za-z0-9_-]{8,64}$/.test(supplied)?supplied:randomUUID();res.set('X-Request-Id',requestId);const start=performance.now();
  res.once('finish',()=>{const event={requestId,method:['GET','HEAD','POST','PATCH','PUT','DELETE','OPTIONS'].includes(req.method)?req.method:'OTHER',route:typeof req.route?.path==='string'?req.route.path:'unmatched',status:res.statusCode,durationMs:Math.round((performance.now()-start)*1000)/1000};metrics?.record(event);try{log?.(event);}catch{/* Logging failure must not fail an accepted request. */}});next();
 };
}
