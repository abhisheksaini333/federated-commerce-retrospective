import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";import os from "node:os";import path from "node:path";
import {runtimeConfig} from "../../scripts/runtime-config";import {validateAssets} from "../../scripts/runtime";
test("startup validates every container before listening",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"commerce-assets-"));
 try {const c=runtimeConfig({},root);assert.throws(()=>validateAssets(c),/host/);
 for(const [name,file] of [["host","index.html"],["catalog","remoteEntry.js"],["cart","remoteEntry.js"]]){const dir=path.join(root,"dist/optimized",name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,file),"fixture");}
 assert.doesNotThrow(()=>validateAssets(c));fs.writeFileSync(path.join(root,"dist/optimized/cart/remoteEntry.js"),"");assert.throws(()=>validateAssets(c),/cart/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
