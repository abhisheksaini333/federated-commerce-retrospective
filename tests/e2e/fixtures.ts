import {test as base,expect} from '@playwright/test';import {runtimeConfig,origin,RuntimeConfig} from '../../scripts/runtime-config';import {startRuntime} from '../../scripts/runtime';import {drainServers} from '../../scripts/runtime-shutdown';
const firstPort=Number(process.env.COMMERCE_TEST_PORT_BASE??4310);
if(!Number.isInteger(firstPort)||firstPort<1024||firstPort>65000)throw Error('COMMERCE_TEST_PORT_BASE must be an integer in 1024..65000.');
export const test=base.extend<{commerceRuntime:RuntimeConfig}>({
 commerceRuntime:[async({},use,info)=>{const host=firstPort+info.parallelIndex*10;const config=runtimeConfig({...process.env,BUILD_VARIANT:'optimized',COMMERCE_HOST_PORT:String(host),COMMERCE_CATALOG_PORT:String(host+1),COMMERCE_CART_PORT:String(host+2),COMMERCE_API_PORT:String(host+3)});const servers=await startRuntime(config);try{await use(config);}finally{await drainServers(servers,1500);}},{auto:true}],
 baseURL:async({commerceRuntime},use)=>use(origin(commerceRuntime,'host')),
});
export {expect};
export function remoteUrl(name:'catalog'|'cart',suffix='/**'){return `http://127.0.0.1:${firstPort+test.info().parallelIndex*10+(name==='catalog'?1:2)}${suffix}`;}
