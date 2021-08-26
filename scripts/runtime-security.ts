import type {RequestHandler} from "express";
import type {RuntimeConfig} from "./runtime-config";
export function localBoundary(config:RuntimeConfig,port:number):RequestHandler{
 const hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
 const origins=new Set(Object.values(config.ports).flatMap(p=>[`http://127.0.0.1:${p}`,`http://localhost:${p}`]));
 return (req,res,next)=>{
  if(!hosts.has((req.headers.host??"").toLowerCase())){res.status(421).json({code:"UNTRUSTED_HOST",error:"Use the configured loopback address."});return;}
  if(!["GET","HEAD","OPTIONS"].includes(req.method)&&req.headers.origin!==undefined&&!origins.has(req.headers.origin)){res.status(403).json({code:"UNTRUSTED_ORIGIN",error:"Mutation origin is not trusted."});return;}
  next();
 };
}
