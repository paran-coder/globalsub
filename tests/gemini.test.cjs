const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../src/core.js');
const source=fs.readFileSync(path.join(__dirname,'../src/gemini.js'),'utf8');
function setup(fetch){const ctx={GlobalSubCore:core,fetch,JSON,Error};ctx.globalThis=ctx;vm.runInNewContext(source,ctx);return ctx.GlobalSubGemini;}
const opts={apiKey:'google-test-key-fake',model:'gemini-3.5-flash-lite',segments:[{id:'1',text:'안녕하세요',start:0,end:1000}],sourceLang:'ko',targetLang:'en',style:'짧게',glossary:''};
const fakeOutput=JSON.stringify({segments:[{id:'1',text:'Hello'}]});
const reply=(str=fakeOutput,usage=55)=>({ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:str}]}}],usageMetadata:{totalTokenCount:usage}})});
test('Gemini REST browser request sends key only to Google and returns matching subtitle IDs',async()=>{
 let request;
 const gemini=setup(async(url,config)=>{request={url,config};return reply();});
 const result=await gemini.translateBatch(opts);
 assert.deepEqual({...result.translation},{'1':'Hello'});
 assert.equal(result.usage.total_tokens,55);
 assert.equal(request.url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
 assert.equal(request.config.headers['x-goog-api-key'],opts.apiKey);
 assert.equal(request.config.headers.Authorization,undefined);
 assert.equal(request.config.mode,'cors');
 const body=JSON.parse(request.config.body);
 assert.equal(body.generationConfig.responseMimeType,'application/json');
 assert.equal(body.generationConfig.responseSchema.properties.segments.type,'ARRAY');
 assert.ok(body.contents[0].parts[0].text.includes('안녕하세요'));
 assert.ok(!request.url.includes(opts.apiKey));
});
test('Gemini rejects missing, duplicate, or unknown subtitle IDs',async()=>{
 for(const content of [
  '{"segments":[]}',
  '{"segments":[{"id":"1","text":"One"},{"id":"1","text":"Two"}]}',
  '{"segments":[{"id":"2","text":"Foreign"}]}'
 ]){const gemini=setup(async()=>reply(content));await assert.rejects(()=>gemini.translateBatch(opts),/누락|중복|없는 자막/);}
});
test('Gemini rejects malformed or empty response',async()=>{
 for(const content of ['not json','']){const gemini=setup(async()=>reply(content));await assert.rejects(()=>gemini.translateBatch(opts),/JSON|결과/);}
});
test('Gemini errors: HTTP 429, CORS/network failure, aborted request',async()=>{
 const rate=setup(async()=>({ok:false,status:429,json:async()=>({error:{message:'quota exceeded'}})}));
 await assert.rejects(()=>rate.translateBatch(opts),/Gemini API HTTP 429/);
 const offline=setup(async()=>{throw new TypeError('Failed to fetch');});
 await assert.rejects(()=>offline.translateBatch(opts),/CORS.*수동 번역 교환/);
 const abort=setup(async()=>{const e=new Error('Aborted');e.name='AbortError';throw e;});
 await assert.rejects(()=>abort.translateBatch(opts),e=>e.name==='AbortError');
});
test('Gemini rejects unsafe model identifier, requires API key',async()=>{
 const gemini=setup(()=>{throw new Error('should not fetch');});
 await assert.rejects(()=>gemini.translateBatch({...opts,apiKey:''}),/키/);
 await assert.rejects(()=>gemini.translateBatch({...opts,model:'../../evil'}),/모델 ID/);
});
