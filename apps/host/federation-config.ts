export type RemoteName='catalog'|'cart';
export interface RemoteConfiguration {version:1;remotes:Record<RemoteName,string>}
export function remoteConfiguration(value:unknown):Record<RemoteName,string>{
 const input=value as RemoteConfiguration;if(!input||input.version!==1||!input.remotes)throw Error('Remote configuration is unavailable.');
 const urls={} as Record<RemoteName,string>;
 for(const name of ['catalog','cart'] as const){const url=new URL(input.remotes[name]);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||!url.port||url.username||url.password||url.pathname!=='/remoteEntry.js'||url.search||url.hash)throw Error('Remote configuration is not trusted.');urls[name]=url.href;}
 return urls;
}

export function validateRemoteModule(value:unknown):{default:((props:any)=>any);contractVersion:1}{const module=value as {default:((props:any)=>any);contractVersion:1};if(!module||module.contractVersion!==1||typeof module.default!=='function')throw Error('This display version is not compatible with the shop.');return module;}
