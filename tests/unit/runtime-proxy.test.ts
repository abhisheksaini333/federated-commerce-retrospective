import test from "node:test";import assert from "node:assert/strict";import http from "node:http";import net from "node:net";import express from "express";
import {apiProxy} from "../../scripts/runtime-proxy";
async function fixture(handler:http.RequestListener,work:(url:string)=>Promise<void>){
 const api=http.createServer(handler);await new Promise<void>(r=>api.listen(0,"127.0.0.1",r));const app=express();app.use(apiProxy((api.address() as net.AddressInfo).port,100));const proxy=http.createServer(app);await new Promise<void>(r=>proxy.listen(0,"127.0.0.1",r));
 try{await work(`http://127.0.0.1:${(proxy.address() as net.AddressInfo).port}`);}finally{api.closeAllConnections();proxy.closeAllConnections();await Promise.all([api,proxy].map(s=>new Promise<void>(r=>s.close(()=>r()))));}
}
test("proxy turns a hung upstream into a bounded service error",async()=>fixture(()=>{},async url=>{const r=await fetch(url);assert.equal(r.status,503);assert.equal((await r.json() as any).code,"API_UNAVAILABLE");}));
test("proxy terminates truncated responses after headers",async()=>fixture((_q,s)=>{s.writeHead(200,{"content-length":"100"});s.write("short");setTimeout(()=>s.destroy(),15);},async url=>{await assert.rejects(async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(1500)});await r.text();});}));
test("proxy cancels upstream work when the caller disconnects",async()=>{
 let closed!:()=>void;const closedPromise=new Promise<void>(r=>closed=r);
 await fixture((_q,s)=>{s.on("close",closed);s.writeHead(200);s.write("started");},async url=>{const controller=new AbortController();const r=await fetch(url,{signal:controller.signal});assert.equal(r.status,200);controller.abort();await Promise.race([closedPromise,new Promise((_,reject)=>setTimeout(()=>reject(new Error("upstream not cancelled")),1000))]);});
});
