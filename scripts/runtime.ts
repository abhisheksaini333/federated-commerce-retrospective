import express from "express";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {localBoundary} from "./runtime-security";
import {apiProxy} from "./runtime-proxy";
import { createApp } from "../apps/api/app";
import { assetDirectory, origin, type RuntimeConfig } from "./runtime-config";
export function validateAssets(config:RuntimeConfig):void {
 for(const [name,file] of [["host","index.html"],["catalog","remoteEntry.js"],["cart","remoteEntry.js"]] as const){const asset=path.join(assetDirectory(config,name),file);let valid=false;try{const stat=fs.statSync(asset);valid=stat.isFile()&&stat.size>0;}catch{}if(!valid)throw new Error(`Missing or empty ${name} build artifact: ${asset}. Run the ${config.variant} build first.`);}
}
export async function startRuntime(config: RuntimeConfig): Promise<http.Server[]> {
  validateAssets(config);
  const servers: http.Server[] = [];
  const apps = [{name:"api" as const, app:createApp()}, ...(["host","catalog","cart"] as const).map(name=>{
    const app=express();app.disable("x-powered-by");
    app.use((_req,res,next)=>{res.set("Cache-Control","no-store");res.set("X-Content-Type-Options","nosniff");next();});
    if(name==="host") app.use("/api",apiProxy(config.ports.api,config.apiTimeoutMs));
    app.use(express.static(assetDirectory(config,name)));return {name,app};
  })];
  try { for(const {name,app} of apps) { const boundary=express();boundary.use(localBoundary(config,config.ports[name]));boundary.use(app);const server=http.createServer(boundary);servers.push(server);await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(config.ports[name],"127.0.0.1",()=>{server.removeListener("error",reject);resolve();});}); } }
  catch(error){for(const server of servers)server.close();throw error;}
  return servers;
}
