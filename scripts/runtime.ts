import express from "express";
import http from "node:http";
import { createApp } from "../apps/api/app";
import { assetDirectory, origin, type RuntimeConfig } from "./runtime-config";
export async function startRuntime(config: RuntimeConfig): Promise<http.Server[]> {
  const servers: http.Server[] = [];
  const apps = [{name:"api" as const, app:createApp()}, ...(["host","catalog","cart"] as const).map(name=>{
    const app=express();app.disable("x-powered-by");
    app.use((_req,res,next)=>{res.set("Cache-Control","no-store");res.set("X-Content-Type-Options","nosniff");next();});
    if(name==="host") app.use("/api",(req,res)=>{
      const upstream=http.request({hostname:"127.0.0.1",port:config.ports.api,path:req.originalUrl,method:req.method,headers:{...req.headers,host:`127.0.0.1:${config.ports.api}`}}, response=>{res.writeHead(response.statusCode||502,response.headers);response.pipe(res);});
      upstream.setTimeout(config.apiTimeoutMs,()=>upstream.destroy(new Error("timeout")));
      upstream.on("error",()=>{if(!res.headersSent)res.status(503).json({code:"API_UNAVAILABLE",error:"The demo service is unavailable. Your bag is saved; try again shortly."});});req.pipe(upstream);
    });
    app.use(express.static(assetDirectory(config,name)));return {name,app};
  })];
  try { for(const {name,app} of apps) { const server=http.createServer(app);servers.push(server);await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(config.ports[name],"127.0.0.1",()=>{server.removeListener("error",reject);resolve();});}); } }
  catch(error){for(const server of servers)server.close();throw error;}
  return servers;
}
