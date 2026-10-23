const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const code=fs.readFileSync(path.join(__dirname,'../src/secure.js'),'utf8');
function createContext(){
 const storage=new Map();
 const localStorage={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k)};
 const ctx={crypto:webcrypto,localStorage,TextEncoder,TextDecoder,Uint8Array,btoa,atob,JSON,Error};ctx.globalThis=ctx;
 vm.runInNewContext(code,ctx);return {sec:ctx.GlobalSubSecure,storage};
}
test('opt-in AES-GCM encrypted key can be unlocked, never stores plaintext',async()=>{
 const {sec,storage}=createContext();
 await sec.saveKey('sk-test-EXAMPLE-ONLY','a-strong-passphrase');
 assert.equal(sec.hasKey(),true);
 assert.doesNotMatch([...storage.values()].join(''),/sk-test-EXAMPLE-ONLY/);
 const restored=await sec.loadKey('a-strong-passphrase');
 assert.equal(restored,'sk-test-EXAMPLE-ONLY');
 await assert.rejects(()=>sec.loadKey('wrong-password'),/암호가 틀렸거나/);
 sec.clearKey();assert.equal(sec.hasKey(),false);
});
test('encryption rejects weak passphrase',async()=>{
 const {sec}=createContext();await assert.rejects(()=>sec.saveKey('sk-test','short'),/8자/);
});

test('Gemini key encryption is isolated from legacy OpenAI storage',async()=>{
 const {sec,storage}=createContext();
 await sec.saveKey('openai-secret-demo','openai-pass-demo');
 await sec.saveKey('gemini-secret-demo','gemini-pass-demo','gemini');
 assert.equal(sec.hasKey(),true);assert.equal(sec.hasKey('gemini'),true);
 assert.equal(storage.size,2);
 assert.equal(await sec.loadKey('openai-pass-demo'),'openai-secret-demo');
 assert.equal(await sec.loadKey('gemini-pass-demo','gemini'),'gemini-secret-demo');
 assert.doesNotMatch([...storage.values()].join(''),/gemini-secret-demo|openai-secret-demo/);
 sec.clearKey('gemini');assert.equal(sec.hasKey('gemini'),false);assert.equal(sec.hasKey(),true);
});
