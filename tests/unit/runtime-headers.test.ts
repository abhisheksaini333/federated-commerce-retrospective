import test from "node:test";import assert from "node:assert/strict";
import {endToEndHeaders} from "../../scripts/runtime-proxy";
test("proxy removes named hop headers and spoofed forwarding identity",()=>{
 const incoming={connection:"keep-alive, X-Secret", "keep-alive":"timeout=10","x-secret":"private",forwarded:"for=attacker","x-forwarded-host":"evil.test",via:"spoof",authorization:"Bearer explicit", "content-type":"application/json"};
 assert.deepEqual(endToEndHeaders(incoming,true),{authorization:"Bearer explicit","content-type":"application/json"});assert.equal(incoming["x-secret"],"private");
});
test("proxy preserves repeated response cookies but removes transport framing",()=>{assert.deepEqual(endToEndHeaders({"set-cookie":["a=1","b=2"],"transfer-encoding":"chunked",connection:"close"}),{"set-cookie":["a=1","b=2"]});});
