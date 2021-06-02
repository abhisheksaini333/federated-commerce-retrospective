export class LatestTask {
 private controller:AbortController|null=null;private generation=0;
 cancel(){this.generation++;this.controller?.abort();this.controller=null;}
 async run<T>(work:(signal:AbortSignal)=>Promise<T>,success:(value:T)=>void,failure:(error:unknown)=>void=()=>{},finish:()=>void=()=>{}){
  this.cancel();const current=this.generation;const controller=new AbortController();this.controller=controller;
  try{const value=await work(controller.signal);if(current===this.generation)success(value);}
  catch(error){if(current===this.generation&&!controller.signal.aborted)failure(error);}
  finally{if(current===this.generation){this.controller=null;finish();}}
 }
}
