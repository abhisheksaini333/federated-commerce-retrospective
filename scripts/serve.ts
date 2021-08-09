import {runtimeConfig, origin} from "./runtime-config";
import {startRuntime} from "./runtime";
async function main(){
  const config=runtimeConfig(); const servers=await startRuntime(config);
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;for(const server of servers)server.close();};
  process.once("SIGINT",stop);process.once("SIGTERM",stop);
  console.log(`Fieldwork Supply (${config.variant}): ${origin(config,"host")} | Synthetic local demo.`);
}
if(require.main===module)main().catch(error=>{console.error((error as Error).message);process.exitCode=1;});
