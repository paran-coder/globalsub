const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../src/core.js');
const source=fs.readFileSync(path.join(__dirname,'../src/api.js'),'utf8');
function setup(fetch){const ctx={GlobalSubCore:core,fetch,JSON,Error};ctx.globalThis=ctx;vm.runInNewContext(source,ctx);return ctx.GlobalSubAPI;}
const opts={apiKey:'sk-test-not-real',model:'gpt-4.1-mini',segments:[{id:'1',text:'안녕하세요',start:0,end:1000}],sourceLang:'ko',targetLang:'en',style:'짧게',glossary:''};
test('browser request uses own key directly and validates returned IDs',async()=>{
 let request;
 const api=setup(async(url,config)=>{request={url,config};return {ok:true,json:async()=>({choices:[{message:{content:'{"segments":[{"id":"1","text":"Hello"}]}'}}],usage:{total_tokens:77}})};});
 const result=await api.translateBatch(opts);assert.deepEqual({...result.translation},{'1':'Hello'});assert.equal(result.usage.total_tokens,77);
 assert.equal(request.url,'https://api.openai.com/v1/chat/completions');assert.equal(request.config.headers.Authorization,`Bearer ${opts.apiKey}`);
 const body=JSON.parse(request.config.body);assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.store,false);assert.equal(body.response_format.type,'json_object');assert.ok(body.messages[1].content.includes('안녕하세요'));
});
test('network/CORS failures are explicit and no proxy fallback occurs',async()=>{
 const api=setup(async()=>{throw new TypeError('Failed to fetch')});
 await assert.rejects(()=>api.translateBatch(opts),/CORS.*수동 교환/);
});
test('API response missing a subtitle is rejected',async()=>{
 const api=setup(async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"segments":[]}'}}]})}));
 await assert.rejects(()=>api.translateBatch(opts),/누락/);
});
