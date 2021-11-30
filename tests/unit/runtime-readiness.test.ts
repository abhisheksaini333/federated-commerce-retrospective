import test from 'node:test';import assert from 'node:assert/strict';import {runtimeConfig} from '../../scripts/runtime-config';import {dependencyReadiness} from '../../scripts/runtime-readiness';
test('host readiness identifies a missing remote while checking every dependency',async()=>{
 const visited:string[]=[];const result=await dependencyReadiness(runtimeConfig({}),async(url,options)=>{visited.push(String(url));assert.equal(options?.method,'HEAD');return new Response(null,{status:String(url).includes(':4312')?503:200});});
 assert.equal(result.status,'degraded');assert.deepEqual(result.dependencies,{api:'ready',catalog:'ready',cart:'unavailable'});assert.equal(visited.length,3);
});
