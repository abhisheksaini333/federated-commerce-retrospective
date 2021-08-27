import type {RequestHandler} from "express";
import type {RuntimeConfig} from "./runtime-config";
export function staticHeaders(config:RuntimeConfig):RequestHandler{
 const origins=Object.values(config.ports).flatMap(p=>[`http://127.0.0.1:${p}`,`http://localhost:${p}`]);
 const sources=origins.join(" ");
 return (req,res,next)=>{
  res.set("Content-Security-Policy",`default-src 'none'; script-src 'self' ${sources}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${sources}; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
  res.set("Referrer-Policy","no-referrer");res.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");res.set("X-Frame-Options","DENY");res.set("Cross-Origin-Resource-Policy","cross-origin");
  const requestOrigin=req.headers.origin;
  if(requestOrigin&&origins.includes(requestOrigin)){res.set("Timing-Allow-Origin",requestOrigin);res.vary("Origin");}
  next();
 };
}
export function localBoundary(config:RuntimeConfig,port:number):RequestHandler{
 const hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
 const origins=new Set(Object.values(config.ports).flatMap(p=>[`http://127.0.0.1:${p}`,`http://localhost:${p}`]));
 return (req,res,next)=>{
  if(!hosts.has((req.headers.host??"").toLowerCase())){res.status(421).json({code:"UNTRUSTED_HOST",error:"Use the configured loopback address."});return;}
  if(!["GET","HEAD","OPTIONS"].includes(req.method)&&req.headers.origin!==undefined&&!origins.has(req.headers.origin)){res.status(403).json({code:"UNTRUSTED_ORIGIN",error:"Mutation origin is not trusted."});return;}
  next();
 };
}
