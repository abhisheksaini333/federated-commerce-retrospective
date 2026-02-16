import {mkdirSync} from "node:fs";import path from "node:path";import {spawnSync} from "node:child_process";import {projectRoot} from "./runtime-config";
export function createRunDirectory(args:string[]):string{
 if(args.filter(value=>value==="--output").length>1)throw new Error("Specify --output only once");
 const index=args.indexOf("--output");if(index<0||!args[index+1]||args[index+1].startsWith("--"))throw new Error("Benchmark requires --output <new-directory>; existing evidence is never overwritten");
 const dir=path.resolve(args[index+1]);mkdirSync(path.dirname(dir),{recursive:true});mkdirSync(dir);return dir;
}
export function sourceIdentity(root=projectRoot):{commit:string;dirty:boolean}{
 const head=spawnSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"});const status=spawnSync("git",["-C",root,"status","--porcelain"],{encoding:"utf8"});if(head.status!==0||status.status!==0)throw new Error("Cannot identify benchmark source checkout");return {commit:head.stdout.trim(),dirty:status.stdout.length>0};
}
