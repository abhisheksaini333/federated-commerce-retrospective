import http from "node:http";
import type {RequestHandler} from "express";
export function endToEndHeaders(input:http.IncomingHttpHeaders,request=false):http.OutgoingHttpHeaders {
 const blocked=new Set(["connection","keep-alive","proxy-authenticate","proxy-authorization","te","trailer","transfer-encoding","upgrade",...(typeof input.connection==="string"?input.connection.split(",").map(x=>x.trim().toLowerCase()):[])]);
 const out:http.OutgoingHttpHeaders={};
 for(const [key,value] of Object.entries(input)){const name=key.toLowerCase();if(!blocked.has(name)&&(!request||(name!=="forwarded"&&!name.startsWith("x-forwarded-")&&name!=="via")))out[name]=value;}
 return out;
}
export function apiProxy(port:number,timeoutMs:number):RequestHandler {
 return (req,res)=>{
  const upstream=http.request({hostname:"127.0.0.1",port,path:req.originalUrl,method:req.method,headers:{...endToEndHeaders(req.headers,true),host:`127.0.0.1:${port}`}},response=>{
   if(res.destroyed){response.destroy();return;}
   res.writeHead(response.statusCode||502,endToEndHeaders(response.headers));
   response.on("error",()=>res.destroy());
   response.on("aborted",()=>res.destroy());
   response.pipe(res);
  });
  upstream.setTimeout(timeoutMs,()=>upstream.destroy(new Error("timeout")));
  upstream.on("error",()=>{if(res.destroyed)return;if(res.headersSent){res.destroy();return;}res.status(503).json({code:"API_UNAVAILABLE",error:"The demo service is unavailable. Your bag is saved; try again shortly."});});
  req.on("aborted",()=>upstream.destroy());
  res.on("close",()=>{if(!res.writableFinished)upstream.destroy();});
  req.pipe(upstream);
 };
}
