import http from "node:http";
import type {RequestHandler} from "express";
export function apiProxy(port:number,timeoutMs:number):RequestHandler {
 return (req,res)=>{
  const upstream=http.request({hostname:"127.0.0.1",port,path:req.originalUrl,method:req.method,headers:{...req.headers,host:`127.0.0.1:${port}`}},response=>{
   if(res.destroyed){response.destroy();return;}
   res.writeHead(response.statusCode||502,response.headers);
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
