import type {RequestHandler} from 'express';import {randomUUID} from 'node:crypto';import {performance} from 'node:perf_hooks';
export interface RequestLog {requestId:string;method:string;route:string;status:number;durationMs:number}
export function requestLogging(log?:(event:RequestLog)=>void):RequestHandler{
 return (req,res,next)=>{const supplied=req.get('X-Request-Id');const requestId=supplied&&/^[A-Za-z0-9_-]{8,64}$/.test(supplied)?supplied:randomUUID();res.set('X-Request-Id',requestId);const start=performance.now();
  res.once('finish',()=>{const event={requestId,method:['GET','HEAD','POST','PATCH','PUT','DELETE','OPTIONS'].includes(req.method)?req.method:'OTHER',route:typeof req.route?.path==='string'?req.route.path:'unmatched',status:res.statusCode,durationMs:Math.round((performance.now()-start)*1000)/1000};try{log?.(event);}catch{/* Logging failure must not fail an accepted request. */}});next();
 };
}
