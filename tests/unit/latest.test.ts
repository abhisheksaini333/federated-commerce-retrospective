import assert from 'node:assert/strict';import {test} from 'node:test';import {LatestTask} from '../../apps/host/latest';
test('newer requests win even when an older transport ignores cancellation',async()=>{
 const latest=new LatestTask();let release!:(value:string)=>void;const values:string[]=[];let aborted=false;
 const old=latest.run(signal=>new Promise<string>(resolve=>{release=resolve;signal.addEventListener('abort',()=>aborted=true);}),value=>values.push(value));
 await latest.run(async()=> 'new',value=>values.push(value));release('old');await old;assert.deepEqual(values,['new']);assert.equal(aborted,true);
 let finished=false;const pending=latest.run(async()=> 'ignored',()=>finished=true);latest.cancel();await pending;assert.equal(finished,false);
});
