import http from 'node:http';
import type { Express } from 'express';
import { before, after } from 'node:test';
import supertest from 'supertest';
const apps=new Map<string,Express>();
const ids=new WeakMap<Express,string>();
let sequence=0;
const server=http.createServer((req,res)=>{
 const app=apps.get(String(req.headers['x-test-application']));
 if(!app){res.writeHead(404);res.end();return;}
 delete req.headers['x-test-application'];
 app(req,res);
});
before(async()=>new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});}));
after(async()=>{apps.clear();server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
/** A single loopback listener avoids short-lived socket reuse while stores remain isolated. */
export function request(app:Express){
 let id=ids.get(app);if(!id){id=String(++sequence);ids.set(app,id);apps.set(id,app);}
 return supertest.agent(server).set('X-Test-Application',id).set('Connection','close');
}
