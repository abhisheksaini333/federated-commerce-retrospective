import {spawn} from "node:child_process";import fs from "node:fs";import os from "node:os";import path from "node:path";
import {chromium} from "@playwright/test";
import {projectRoot,runtimeConfig,origin} from "./runtime-config";
import {waitReady,stopChild} from "./benchmark-lifecycle";
async function main(){
 const config=runtimeConfig();const cwd=fs.mkdtempSync(path.join(os.tmpdir(),"commerce-release-"));
 const server=spawn(process.execPath,[path.join(projectRoot,"node_modules/tsx/dist/cli.mjs"),path.join(projectRoot,"scripts/serve.ts")],{cwd,env:{...process.env},stdio:["ignore","pipe","pipe"]});
 let log="";server.stdout?.on("data",x=>{log=(log+x).slice(-100000);});server.stderr?.on("data",x=>{log=(log+x).slice(-100000);});
 try{
  await waitReady(server,origin(config,"host")+"/api/health");
  const browser=await chromium.launch();
  try{const page=await browser.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.goto(origin(config,"host"));await page.getByRole("button",{name:"Add Everyday notebook"}).waitFor();await page.getByRole("button",{name:"Bag (0)"}).click();await page.getByText("Your next everyday favorite is waiting.").waitFor();if(errors.length)throw new Error(errors.join("; "));console.log(JSON.stringify({variant:config.variant,cwdIndependent:true,host:true,catalog:true,cart:true,api:true,pageErrors:errors}));}finally{await browser.close();}
 }catch(error){console.error(log);throw error;}finally{await stopChild(server);fs.rmSync(cwd,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error((error as Error).message);process.exitCode=1;});
