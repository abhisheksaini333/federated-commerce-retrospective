import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {runtimeConfig,origin,assetDirectory,projectRoot} from "../../scripts/runtime-config";
test("runtime rejects ambiguous ports, variants and deadlines",()=>{
 for(const env of [{COMMERCE_HOST_PORT:"0"},{COMMERCE_HOST_PORT:"1e3"},{COMMERCE_API_PORT:"65536"},{COMMERCE_API_PORT:"4310"},{BUILD_VARIANT:"typo"},{COMMERCE_SHUTDOWN_MS:"-1"}])assert.throws(()=>runtimeConfig(env));
});
test("runtime configuration is isolated and independent of cwd",()=>{
 const a=runtimeConfig({COMMERCE_HOST_PORT:"14310",BUILD_VARIANT:"baseline"});
 assert.equal(origin(a,"host"),"http://127.0.0.1:14310");assert.equal(assetDirectory(a,"cart"),path.join(projectRoot,"dist/baseline/cart"));assert.equal(runtimeConfig({}).ports.host,4310);
});
