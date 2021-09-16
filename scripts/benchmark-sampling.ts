export function sampleCount(args:string[]):number{
 const i=args.indexOf("--samples");if(i<0)return 3;const raw=args[i+1];if(!raw||!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>50)throw new Error("--samples must be an integer in 1..50");return Number(raw);
}
export function sampleSchedule(count:number):{variant:"baseline"|"optimized";sample:number}[]{
 if(!Number.isInteger(count)||count<1||count>50)throw new Error("Invalid sample count");
 return Array.from({length:count},(_,index)=>{const variants:("baseline"|"optimized")[]=index%2?["optimized","baseline"]:["baseline","optimized"];return variants.map(variant=>({variant,sample:index+1}));}).flat();
}
export function distribution(values:number[]){
 if(!values.length||values.some(n=>!Number.isFinite(n)||n<0))throw new Error("Expected finite nonnegative observations");
 const sorted=[...values].sort((a,b)=>a-b),n=sorted.length,mean=sorted.reduce((a,b)=>a+b,0)/n;
 return {count:n,min:sorted[0],max:sorted[n-1],mean,median:n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2,p95:sorted[Math.ceil(n*.95)-1]};
}
