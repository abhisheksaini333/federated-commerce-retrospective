import test from "node:test";import assert from "node:assert/strict";import http from "node:http";import net from "node:net";
import {drainServers} from "../../scripts/runtime-shutdown";
const listen=(s:http.Server)=>new Promise<number>(resolve=>s.listen(0,"127.0.0.1",()=>resolve((s.address() as net.AddressInfo).port)));
test("shutdown completes an accepted response",async()=>{
 let accepted!:()=>void;const received=new Promise<void>(r=>accepted=r);const server=http.createServer((_q,s)=>{accepted();setTimeout(()=>s.end("committed"),30);});const port=await listen(server);
 const response=fetch(`http://127.0.0.1:${port}`);await received;await drainServers([server],1000);assert.equal(await (await response).text(),"committed");
});
test("shutdown forces stalled accepted requests at its deadline",async()=>{
 let accepted!:()=>void;const received=new Promise<void>(r=>accepted=r);const server=http.createServer(()=>accepted());const port=await listen(server);const request=http.get(`http://127.0.0.1:${port}`);request.on("error",()=>{});await received;const start=Date.now();await drainServers([server],30);assert.ok(Date.now()-start<1000);request.destroy();
});
