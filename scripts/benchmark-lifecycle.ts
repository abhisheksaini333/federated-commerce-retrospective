import type {ChildProcess} from "node:child_process";
export async function stopChild(child:ChildProcess,graceMs=1500):Promise<void>{
 if(child.exitCode!==null||child.signalCode!==null)return;
 await new Promise<void>(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);child.removeListener("exit",finish);resolve();};const timer=setTimeout(()=>{child.kill("SIGKILL");},graceMs);child.once("exit",finish);child.kill("SIGTERM");if(child.exitCode!==null||child.signalCode!==null)finish();});
}
export async function waitReady(child:ChildProcess,url:string,deadlineMs=8000,signal?:AbortSignal):Promise<void>{
 const deadline=Date.now()+deadlineMs;
 while(Date.now()<deadline){signal?.throwIfAborted();if(child.exitCode!==null||child.signalCode!==null)throw new Error("Demo server exited before readiness");
  try{const timeout=AbortSignal.timeout(Math.max(1,Math.min(300,deadline-Date.now())));const response=await fetch(url,{signal:signal?AbortSignal.any([signal,timeout]):timeout});const healthy=response.ok;await response.body?.cancel();if(healthy&&child.exitCode===null&&child.signalCode===null)return;}catch(error){signal?.throwIfAborted();}
  await new Promise(r=>setTimeout(r,Math.min(100,Math.max(0,deadline-Date.now()))));
 }
 throw new Error("Demo server failed to become ready before deadline");
}
