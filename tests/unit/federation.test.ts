import assert from 'node:assert/strict';import {test} from 'node:test';import {remoteConfiguration} from '../../apps/host/federation-config';
test('runtime remote configuration accepts declared loopback entries and rejects arbitrary code origins',()=>{
 const config={version:1,remotes:{catalog:'http://127.0.0.1:4511/remoteEntry.js',cart:'http://127.0.0.1:4512/remoteEntry.js'}};
 assert.deepEqual(remoteConfiguration(config),config.remotes);
 for(const value of ['https://example.com/remoteEntry.js','http://user:pass@127.0.0.1:4511/remoteEntry.js','http://127.0.0.1:4511/other.js','javascript:alert(1)'])assert.throws(()=>remoteConfiguration({...config,remotes:{...config.remotes,catalog:value}}));
 assert.throws(()=>remoteConfiguration({...config,version:2}));
});
