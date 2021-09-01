import fs from "node:fs";
export interface AssetBudget { single:number; total:number }
export const defaultBudgets:Record<string,AssetBudget>={host:{single:250000,total:600000},catalog:{single:250000,total:600000},cart:{single:250000,total:600000}};
export function checkBudgets(stats:unknown,budgets=defaultBudgets):{container:string;assets:number;bytes:number}[]{
 const children=(stats as any)?.children;if(!Array.isArray(children))throw new Error("Expected webpack multi-compiler statistics with children");
 const seen=new Set<string>();const report=[];
 for(const child of children){const name=child?.name;if(typeof name!=="string"||!budgets[name]||seen.has(name))throw new Error(`Unexpected or repeated container: ${name}`);seen.add(name);if(child.errorsCount||child.errors?.length)throw new Error(`${name} compilation contains errors`);
  if(!Array.isArray(child.assets))throw new Error(`${name} statistics omit assets`);
  let total=0,count=0;const assetNames=new Set<string>();
  for(const asset of child.assets){if(!asset||typeof asset.name!=="string"||!Number.isSafeInteger(asset.size)||asset.size<0)throw new Error(`${name} contains invalid asset statistics`);if(assetNames.has(asset.name))throw new Error(`${name} repeats asset ${asset.name}`);assetNames.add(asset.name);if(!/\.(js|html|css)$/.test(asset.name))continue;count++;total+=asset.size;if(asset.size>budgets[name].single)throw new Error(`${name}/${asset.name}: ${asset.size} bytes exceeds single-asset budget ${budgets[name].single}`);}
  if(!count)throw new Error(`${name} has no deployable assets`);if(total>budgets[name].total)throw new Error(`${name}: ${total} bytes exceeds container budget ${budgets[name].total}`);report.push({container:name,assets:count,bytes:total});
 }
 for(const name of Object.keys(budgets))if(!seen.has(name))throw new Error(`Missing container statistics: ${name}`);return report;
}
if(require.main===module){try{const args=process.argv.slice(2);if(args.length!==1)throw new Error("Usage: tsx scripts/check-build.ts <webpack-stats.json>");console.log(JSON.stringify(checkBudgets(JSON.parse(fs.readFileSync(args[0],"utf8"))),null,2));}catch(e){console.error((e as Error).message);process.exitCode=1;}}
