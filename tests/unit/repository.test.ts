import {test} from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
test('release source never tracks machine-local dependency paths',()=>{const files=execFileSync('git',['ls-files','node_modules'],{encoding:'utf8'});assert.equal(files,'');});
