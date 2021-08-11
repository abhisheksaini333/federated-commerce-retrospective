import type http from "node:http";
export function drainServers(servers:http.Server[],deadlineMs:number):Promise<void>{
 return new Promise(resolve=>{
  if(!servers.length){resolve();return;}let remaining=servers.length,done=false;
  const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};
  const timer=setTimeout(()=>{for(const server of servers)server.closeAllConnections();finish();},deadlineMs);
  for(const server of servers){server.close(()=>{if(--remaining===0)finish();});server.closeIdleConnections();}
 });
}
