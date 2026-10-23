/* GlobalSub v1.3.1 — browser-only application. No application server, analytics or external JS. */
(function(){
'use strict';
const C=globalThis.GlobalSubCore,SEC=globalThis.GlobalSubSecure,API=globalThis.GlobalSubAPI,GEMINI=globalThis.GlobalSubGemini;
const PROJECT_KEY='globalsub_v1_project',MODELS_KEY='globalsub_v1_models',PRESETS_KEY='globalsub_v1_presets',PROVIDER_KEY='globalsub_v1_provider';
const $=id=>document.getElementById(id), all=(selector)=>Array.from(document.querySelectorAll(selector));
const defaults={economy:'gpt-4.1-mini',quality:'gpt-4.1',geminiEconomy:'gemini-3.5-flash-lite',geminiQuality:'gemini-3.8-flash'};
function getStored(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback;}catch{return fallback;}}
let models={...defaults,...getStored(MODELS_KEY,{})};
let provider=getStored(PROVIDER_KEY,'openai')==='gemini'?'gemini':'openai';
let userPresets=Object.fromEntries(Object.entries(getStored(PRESETS_KEY,{})||{}).filter(([name,codes])=>name.length<=20&&Array.isArray(codes)&&codes.every(code=>C.LANGUAGES.some(l=>l.code===code))).slice(0,30));
const storedProject=restoreProject(getStored(PROJECT_KEY,null));
function isUnchangedLegacyDemo(p){
 if(!p||p.demoOpenedExplicitly||p.name!=='미드나잇 시그널'||p.sourceLang!=='ko'||p.glossary)return false;
 const demo=C.makeDemoProject();
 if(p.style!==demo.style||JSON.stringify(p.selectedLanguages)!==JSON.stringify(demo.selectedLanguages))return false;
 const cues=p.segments.map(({id,start,end,text})=>({id,start,end,text}));
 if(JSON.stringify(cues)!==JSON.stringify(demo.segments))return false;
 for(const lang of new Set([...Object.keys(p.translations),...Object.keys(demo.translations)])){
  if(JSON.stringify(p.translations[lang]||{})!==JSON.stringify(demo.translations[lang]||{}))return false;
 }
 return !Object.values(p.staleTranslations||{}).some(flags=>Object.keys(flags||{}).length);
}
// v1.1.0의 수정되지 않은 내장 예제가 브라우저에 저장되었을 경우만 빈 프로젝트로 이행한다.
const migratedExample=isUnchangedLegacyDemo(storedProject);
if(migratedExample)try{localStorage.removeItem(PROJECT_KEY);}catch{}
let project=(storedProject&&!migratedExample?storedProject:null)||blankProject();
project.staleTranslations ||= {};
let activeView='studio',filter='all',selectedId=project.segments[0]?.id||null,apiKey='',geminiKey='',videoURL='',currentVideo=null;
let controller=null,manualStart=0,busy=false,toastTimer=null,autosaveTimer=null;
function blankProject(){return {name:'새 프로젝트',sourceLang:'ko',segments:[],translations:{},selectedLanguages:['en','ja','es'],activeLanguage:'en',style:'자연스럽고 간결하게. 원문의 의미와 뉘앙스를 유지',glossary:'',staleTranslations:{},updatedAt:Date.now()};}
function restoreProject(o){
 if(!o||typeof o!=='object'||!Array.isArray(o.segments)||o.segments.length>100000)return null;
 const cues=[],ids=new Set();
 for(const item of o.segments){
  if(!item||typeof item.text!=='string'||item.text.length>20000||!Number.isFinite(item.start)||!Number.isFinite(item.end)||item.start<0||item.end<=item.start||item.end>360000000)return null;
  const id=String(item.id);if(ids.has(id)||!/^\d{1,6}$/.test(id))return null;ids.add(id);
  cues.push({id,start:item.start,end:item.end,text:item.text});
 }
 const translations={};for(const [lang,values] of Object.entries(o.translations||{})){
  if(!C.LANGUAGES.find(x=>x.code===lang)||typeof values!=='object'||!values)continue;
  translations[lang]={};for(const [id,text] of Object.entries(values)){if(ids.has(id)&&typeof text==='string'&&text.length<25000)translations[lang][id]=text;}
 }
 const selected=Array.isArray(o.selectedLanguages)?o.selectedLanguages.filter(x=>C.LANGUAGES.some(l=>l.code===x)&&x!==o.sourceLang):[];
 const staleTranslations={};for(const [lang,flags] of Object.entries(o.staleTranslations||{})){
  if(!C.LANGUAGES.some(l=>l.code===lang)||!flags||typeof flags!=='object')continue;
  staleTranslations[lang]={};for(const [id,value] of Object.entries(flags))if(ids.has(id)&&value===true)staleTranslations[lang][id]=true;
 }
 return {name:String(o.name||'프로젝트').slice(0,100),sourceLang:C.LANGUAGES.some(l=>l.code===o.sourceLang)?o.sourceLang:'ko',segments:cues,translations,
   selectedLanguages:[...new Set(selected)],activeLanguage:C.LANGUAGES.some(l=>l.code===o.activeLanguage)?o.activeLanguage:(selected[0]||'en'),
   style:String(o.style||'자연스럽고 간결하게. 원문의 의미와 뉘앙스를 유지').slice(0,250),
   glossary:String(o.glossary||'').slice(0,15000),staleTranslations,demoOpenedExplicitly:o.demoOpenedExplicitly===true,updatedAt:Date.now()};
}
function toast(message,error=false){const el=$('toast');el.textContent=message;el.classList.toggle('error',error);el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,error?9000:4500);}
function persist(){project.updatedAt=Date.now();clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{try{localStorage.setItem(PROJECT_KEY,JSON.stringify(project));$('saveState').textContent='● 로컬 자동 저장';}catch{toast('브라우저 저장 공간이 부족합니다. 프로젝트 백업 파일을 저장해 주세요.',true);}},350);}
function confirmDialog(title,body,confirmLabel='확인'){
 return new Promise(resolve=>{const el=$('modal');$('modalTitle').textContent=title;$('modalBody').textContent=body;$('modalConfirm').textContent=confirmLabel;el.hidden=false;
  const done=value=>{el.hidden=true;$('modalConfirm').removeEventListener('click',yes);$('modalCancel').removeEventListener('click',no);resolve(value);};
  const yes=()=>done(true),no=()=>done(false);$('modalConfirm').addEventListener('click',yes);$('modalCancel').addEventListener('click',no);
 });
}
function switchView(view){activeView=view;for(const name of ['studio','manual','settings','guide'])$(name+'View').hidden=name!==view;
 all('.side-link').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('crumbTitle').textContent=({studio:'자막 스튜디오',manual:'수동 번역 교환',settings:'API · 설정',guide:'이용 가이드'})[view];
 if(view==='manual')renderManual();if(view==='settings')renderSettings();window.scrollTo({top:0,behavior:'instant'});}
function bindNav(){all('.side-link').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));$('settingsQuick').addEventListener('click',()=>switchView('settings'));
 $('guideQuick').addEventListener('click',()=>switchView('guide'));
 all('[data-guide-to]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.guideTo)));}
function makeOption(value,label){const opt=document.createElement('option');opt.value=value;opt.textContent=label;return opt;}
function addOptions(select,opts){select.replaceChildren();opts.forEach(item=>select.add(makeOption(item.code,item.korean===item.label?item.korean:`${item.korean} · ${item.label}`)));}
function activeApiKey(){return provider==='gemini'?geminiKey:apiKey;}
function updateApiStatus(){
 const active=activeApiKey(),el=$('apiStatus');
 const providerName=provider==='gemini'?'Gemini':'OpenAI';
 const savedKey=SEC.hasKey(provider);
 el.textContent=active?`${providerName} 키 등록됨 · 연결 미검증`:savedKey?`${providerName} 키 잠김 · 잠금 해제 필요`:`${providerName} 키 미등록`;
 el.classList.toggle('online',!!active);
 $('keyState').textContent=apiKey?'현재 탭 메모리에 OpenAI 키가 있습니다. 연결 상태는 번역 시 확인됩니다.':SEC.hasKey()?'암호화된 OpenAI 키가 저장되어 있습니다.':'OpenAI 키가 등록되지 않았습니다.';
 $('geminiKeyState').textContent=geminiKey?'현재 탭 메모리에 Gemini 키가 있습니다. 연결 상태는 번역 시 확인됩니다.':SEC.hasKey('gemini')?'암호화된 Gemini 키가 저장되어 있습니다.':'Gemini 키가 등록되지 않았습니다.';
}
function currentLanguage(){if(project.activeLanguage===project.sourceLang||!C.LANGUAGES.some(x=>x.code===project.activeLanguage))return project.selectedLanguages[0]||C.LANGUAGES.find(x=>x.code!==project.sourceLang)?.code||'en';return project.activeLanguage;}
function currentTranslation(){return project.translations[currentLanguage()]||{};}
function quality(lang=currentLanguage()){const base=C.analyze(project.segments,project.translations[lang]||{},lang);for(const [id,stale] of Object.entries(project.staleTranslations?.[lang]||{}))if(stale&&project.segments.some(s=>s.id===id))base.issues.push({id,label:'원본 변경됨',detail:'원본 수정 후 번역 갱신이 필요합니다.',severity:'warning'});return base;}
function renderAll(){
 if(!project.selectedLanguages.length){project.activeLanguage=C.LANGUAGES.find(x=>x.code!==project.sourceLang)?.code||'en';}
 else if(!project.selectedLanguages.includes(project.activeLanguage))project.activeLanguage=project.selectedLanguages[0];
 $('sideProjectName').textContent=project.segments.length?project.name:'새 프로젝트';$('sideProjectMeta').textContent=project.segments.length?`${C.localizedName(project.sourceLang)} · ${project.segments.length}개 자막`:'SRT 파일을 불러오세요';
 const isDemo=project.name==='미드나잇 시그널';$('projectType').textContent=isDemo?'체험용 샘플 · 실제 작업 파일 아님':project.segments.length?'현재 편집 중인 프로젝트':'새 작업 준비 중 · 파일 미선택';
 $('projectType').classList.toggle('is-demo',isDemo);
 $('statSegments').innerHTML=`${project.segments.length}<span>개 구간</span>`;
 const complete=Object.entries(project.translations).filter(([lang,map])=>lang!==project.sourceLang&&project.segments.length>0&&project.segments.every(s=>map?.[s.id]?.trim())).length;
 $('statLanguages').innerHTML=`${complete}<span>개 언어</span>`;
 $('statIssues').innerHTML=`${quality().issues.length}<span>건 발견</span>`;
 $('editorCount').textContent=`${project.segments.length}개 구간`;
 $('sourceLang').value=project.sourceLang;$('stylePreset').value=project.style;
 $('targetCount').textContent=`${project.selectedLanguages.filter(l=>l!==project.sourceLang).length}개 선택`;
 renderLanguageChoices();renderTabs();renderTranslationState();renderCueList();renderDetail();renderPresets();updateApiStatus();renderVideoSubtitle();
}
function renderLanguageChoices(){const wrap=$('languageChoices');wrap.replaceChildren();for(const lang of C.LANGUAGES){if(lang.code===project.sourceLang)continue;
 const label=document.createElement('label');label.className='lang-choice';const check=document.createElement('input');check.type='checkbox';check.value=lang.code;check.checked=project.selectedLanguages.includes(lang.code);
 const names=document.createElement('span');names.className='language-text';
 const main=document.createElement('strong');main.className='language-ko';main.textContent=lang.korean;
 const native=document.createElement('small');native.className='language-native';native.textContent=lang.label;native.dir='auto';
 names.append(main,native);label.append(check,names);wrap.append(label);
 check.addEventListener('change',()=>{project.selectedLanguages=check.checked?[...new Set([...project.selectedLanguages,lang.code])]:project.selectedLanguages.filter(x=>x!==lang.code);
 if(!project.selectedLanguages.includes(project.activeLanguage))project.activeLanguage=project.selectedLanguages[0]||'en';persist();renderAll();});
 }}
function renderPresets(){const strip=$('presetStrip');strip.querySelectorAll('.user-preset').forEach(x=>x.remove());for(const [name,langs] of Object.entries(userPresets)){
 const btn=document.createElement('button');btn.type='button';btn.className='preset-chip user-preset';btn.textContent='★ '+name;btn.title=`${langs.join(', ')} (Alt + 클릭하여 삭제)`;
 btn.addEventListener('click',e=>{if(e.altKey){delete userPresets[name];savePresets();renderPresets();toast('프리셋이 삭제되었습니다.');return;}applyPreset(langs);});strip.insertBefore(btn,$('savePreset'));
 }}
function savePresets(){try{localStorage.setItem(PRESETS_KEY,JSON.stringify(userPresets));}catch{toast('프리셋을 저장할 수 없습니다.',true);}}
function applyPreset(langs){project.selectedLanguages=langs.filter(code=>code!==project.sourceLang);project.activeLanguage=project.selectedLanguages[0]||'en';persist();renderAll();toast(`${project.selectedLanguages.length}개 언어가 선택되었습니다.`);}
function translationStats(lang){
 const total=project.segments.length;const done=project.segments.filter(item=>(project.translations[lang]?.[item.id]||'').trim()).length;
 return {total,done,label:!total?'대기':done===total?'완료':done?'일부':'미번역'};
}
function renderTabs(){const parent=$('editorLanguageTabs');parent.replaceChildren();const options=[...new Set([...project.selectedLanguages,...Object.keys(project.translations)])].filter(x=>x!==project.sourceLang&&C.LANGUAGES.some(l=>l.code===x));
 if(!options.length){const tip=document.createElement('span');tip.className='tab-button';tip.textContent='번역할 언어를 먼저 선택하세요';parent.append(tip);return;}
 for(const code of options){const stats=translationStats(code);const button=document.createElement('button');button.type='button';button.className='tab-button'+(code===currentLanguage()?' selected':'');button.role='tab';button.setAttribute('aria-selected',String(code===currentLanguage()));button.setAttribute('aria-label',`${C.localizedName(code)} · ${stats.label} ${stats.done}/${stats.total}`);
 const title=document.createElement('span');title.textContent=C.localizedName(code);
 const count=document.createElement('small');count.className='tab-progress '+(stats.label==='완료'?'is-complete':stats.label==='미번역'?'is-empty':'');count.textContent=stats.label;
 button.append(title,count);button.addEventListener('click',()=>{project.activeLanguage=code;persist();renderAll();});parent.append(button);
 }}
function renderTranslationState(){const el=$('editorTranslationState');const lang=currentLanguage();const {total,done,label}=translationStats(lang);
 el.replaceChildren();const tag=document.createElement('strong');tag.className='translation-state-label';tag.textContent=total?`${C.localizedName(lang)} · ${label} ${done}/${total}`:'SRT 원본이 필요합니다';
 const info=document.createElement('span');info.textContent=!total?'먼저 SRT 파일을 불러오세요. 언어를 고르는 것만으로 번역되지는 않습니다.':done===total?'이 언어의 모든 자막에 번역문이 있습니다. 내용은 직접 최종 검수하세요.':done?'일부 자막이 비어 있습니다. API 번역을 실행하거나 수동 번역 교환으로 추가하세요.':'아직 이 언어로 번역하지 않았습니다. 자동 번역은 API 키 등록과 번역 실행이 필요합니다.';
 el.append(tag,info);el.classList.toggle('not-translated',!done&&!!total);
}

function renderCueList(){const parent=$('cueList');parent.replaceChildren();const issues=quality().issues,issueIds=new Set(issues.map(x=>x.id)),trans=currentTranslation();
 const segments=filter==='issues'?project.segments.filter(s=>issueIds.has(s.id)):project.segments;
 if(!segments.length){const div=document.createElement('div');div.className='cue-item';div.textContent=project.segments.length?'현재 표시할 자막 문제가 없습니다.':'먼저 SRT 자막을 불러오세요.';parent.append(div);return;}
 for(const s of segments){const row=document.createElement('div');row.className='cue-item'+(s.id===selectedId?' selected':'');row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',`${s.id}번 자막 편집`);
 const index=document.createElement('div');index.className='cue-index';index.textContent=s.id;
 const lines=document.createElement('div');lines.className='cue-lines';
 const time=document.createElement('div');time.className='cue-time';time.textContent=`${C.formatTime(s.start)} → ${C.formatTime(s.end)}`;
 const original=document.createElement('div');original.className='cue-original';original.textContent=s.text;
 const translated=document.createElement('div');translated.className='cue-translated';translated.textContent=trans[s.id]||'번역 전 · 결과 없음';
 lines.append(time,original,translated);row.append(index,lines);
 if(issueIds.has(s.id)){const warning=document.createElement('span');warning.className='cue-warning';warning.textContent='⚑';warning.title='검수 알림이 있는 자막';row.append(warning);}
 const select=()=>{selectedId=s.id;renderCueList();renderDetail();};row.addEventListener('click',select);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});parent.append(row);
 }}
function renderDetail(){const s=project.segments.find(x=>x.id===selectedId)||project.segments[0];
 const isEmpty=!s;$('sourceText').disabled=isEmpty;$('translatedText').disabled=isEmpty;$('retranslateOne').disabled=isEmpty;
 if(!s){$('detailTitle').textContent='자막이 없습니다';$('detailTime').textContent='--:--';$('sourceText').value='';$('translatedText').value='';$('emptyTranslationActions').hidden=true;$('reviewBox').textContent='';return;}
 selectedId=s.id;$('detailTitle').textContent=`자막 #${s.id}`;$('detailTime').textContent=`${C.formatTime(s.start)} — ${C.formatTime(s.end)}`;
 $('sourceText').value=s.text;$('translatedText').value=currentTranslation()[s.id]||'';
 $('detailLanguageName').textContent=C.localizedName(currentLanguage());$('emptyTranslationActions').hidden=!!currentTranslation()[s.id]?.trim();renderReviewBox(s.id);
}
function renderReviewBox(id){const wrap=$('reviewBox');wrap.replaceChildren();const issues=quality().issues.filter(x=>x.id===id);
 if(!issues.length){const ok=document.createElement('span');ok.className='review-good';ok.textContent='✓ 구조 및 길이 검사 통과 (번역의 의미 검수는 별도)';wrap.append(ok);return;}
 for(const issue of issues){const chip=document.createElement('span');chip.className='review-warning';chip.title=issue.detail;chip.textContent=`⚑ ${issue.label}`;wrap.append(chip);}
}
function renderVideoSubtitle(){if(!currentVideo){$('videoSubtitle').textContent='';return;}
 const seconds=currentVideo.currentTime*1000,s=project.segments.find(s=>s.start<=seconds&&seconds<s.end);
 $('videoSubtitle').textContent=s?(currentTranslation()[s.id]||s.text):'';
}
function renderManual(){
 const select=$('manualLanguage');const before=select.value||currentLanguage();
 const langs=C.LANGUAGES.filter(x=>x.code!==project.sourceLang);addOptions(select,langs);select.value=langs.some(l=>l.code===before)?before:(currentLanguage());
 updateManualPrompt();
}
function manualSegmentBatch(){return project.segments.slice(manualStart,manualStart+30);}
function updateManualPrompt(){const lang=$('manualLanguage').value||currentLanguage(),total=project.segments.length;manualStart=Math.max(0,Math.min(manualStart,Math.max(0,Math.ceil(total/30)-1)*30));
 const batch=manualSegmentBatch();$('manualPageLabel').textContent=total?`${manualStart+1}–${manualStart+batch.length} / ${total}`:'0 / 0';
 $('manualPrev').disabled=manualStart===0;$('manualNext').disabled=manualStart+30>=total;
 $('manualPrompt').value=batch.length?C.buildPrompt(batch,project.sourceLang,lang,project.style,project.glossary):'먼저 SRT 파일을 불러오세요.';
}
function storeModelInputs(){
 if(provider==='gemini'){models.geminiEconomy=$('economyModel').value.trim()||defaults.geminiEconomy;models.geminiQuality=$('qualityModel').value.trim()||defaults.geminiQuality;}
 else{models.economy=$('economyModel').value.trim()||defaults.economy;models.quality=$('qualityModel').value.trim()||defaults.quality;}
}
function renderSettings(){
 $('providerSelect').value=provider;
 $('economyModel').value=provider==='gemini'?models.geminiEconomy:models.economy;
 $('qualityModel').value=provider==='gemini'?models.geminiQuality:models.quality;
 $('glossary').value=project.glossary;
 updateApiStatus();
}
// Selecting or unlocking a provider's key makes that provider the active translation engine.
// Preserve unsaved model/glossary input in Settings when switching providers.
function selectProvider(next){
 const draft=$('glossary').value;
 storeModelInputs();
 provider=next==='gemini'?'gemini':'openai';
 try{localStorage.setItem(PROVIDER_KEY,JSON.stringify(provider));}catch{}
 renderSettings();
 $('glossary').value=draft;
}
function downloadBytes(filename,bytes,mime){const blob=new Blob([bytes],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadString(name,content,mime='text/plain;charset=utf-8'){downloadBytes(name,new TextEncoder().encode(content),mime);}
function exportCurrent(){const lang=currentLanguage();try{if(!project.segments.length)throw new Error('먼저 SRT 파일을 불러오세요.');const text=C.serializeSrt(project.segments,project.translations,lang);downloadString(`${C.safeFilename(project.name)}.${lang}.srt`,'\ufeff'+text,'application/x-subrip;charset=utf-8');toast(`${C.languageName(lang)} SRT 파일을 저장했습니다.`);}catch(e){toast(e.message,true);}}
function exportAll(){if(!project.segments.length){toast('먼저 SRT 파일을 불러오세요.',true);return;}
 const stem=C.safeFilename(project.name),files=[{name:`${stem}.${project.sourceLang}.srt`,content:'\ufeff'+C.serializeSrt(project.segments,null,null)}];
 const langs=Object.keys(project.translations).filter(lang=>lang!==project.sourceLang&&project.segments.every(s=>project.translations[lang]?.[s.id]?.trim()));
 for(const lang of langs)files.push({name:`${stem}.${lang}.srt`,content:'\ufeff'+C.serializeSrt(project.segments,project.translations,lang)});
 if(!langs.length){toast('완성된 번역 언어가 없습니다. 원본 파일만 내보내지 않습니다.',true);return;}
 files.push({name:'README.txt',content:`GlobalSub v1.3.0\n프로젝트: ${project.name}\n원본: ${project.sourceLang}\n번역: ${langs.join(', ')}\n\n각 SRT 파일을 YouTube Studio의 해당 언어 자막으로 직접 업로드해 주세요.\n`});
 downloadBytes(`${stem}.subtitles.zip`,C.makeZip(files),'application/zip');toast(`원본 + 완성된 ${langs.length}개 언어를 ZIP으로 저장했습니다.`);
}
function backup(){const payload={schema:'globalsub-project',version:'1.0.0',exportedAt:new Date().toISOString(),project};downloadString(`${C.safeFilename(project.name)}.globalsub.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');toast('프로젝트 JSON 백업 완료 · API 키와 영상은 제외되었습니다.');}
async function importSrt(file){if(!file)return;try{const content=await file.text();const result=C.parseSrt(content);
 const broken=result.errors.filter(message=>message.includes('블록:'));
 if(broken.length)throw new Error(`손상된 SRT 구간 ${broken.length}개가 있습니다. 자막을 누락시키지 않도록 불러오기를 중단했습니다. ${broken[0]}`);
 if(project.segments.length&&!await confirmDialog('다른 SRT 파일 불러오기','현재 프로젝트의 기존 자막과 번역을 새 파일로 교체합니다. 저장할 작업이 있다면 취소하고 백업하세요.','교체'))return;
 project=blankProject();project.name=C.safeFilename(file.name);project.segments=result.segments;project.sourceLang=C.detectLanguage(result.segments);project.selectedLanguages=['en','ja','es','fr','de'].filter(x=>x!==project.sourceLang);project.activeLanguage=project.selectedLanguages[0]||'en';selectedId=project.segments[0]?.id||null;manualStart=0;persist();renderAll();switchView('studio');toast(`${result.segments.length}개 자막을 불러왔습니다.${result.errors.length?` 형식 경고 ${result.errors.length}개.`:''}`);if(result.errors.length)console.info('SRT overlapping timestamps:',result.errors);}catch(e){toast(e.message,true);}finally{$('srtInput').value='';}}
async function importBackup(file){if(!file)return;try{if(file.size>15000000)throw new Error('백업 파일이 너무 큽니다 (15MB 이하).');const obj=JSON.parse(await file.text());if(obj.schema!=='globalsub-project'||!obj.project)throw new Error('GlobalSub 백업 형식이 아닙니다.');const restored=restoreProject(obj.project);if(!restored)throw new Error('프로젝트 자막 데이터가 잘못되었습니다.');project=restored;selectedId=project.segments[0]?.id||null;manualStart=0;persist();renderAll();switchView('studio');toast('프로젝트를 복원했습니다. API 키와 영상 파일은 별도로 설정하세요.');}catch(e){toast(e.message,true);}finally{$('backupInput').value='';}}
function updateProgress(done,total,description){$('translationProgress').hidden=false;$('progressText').textContent=`${description} · ${done}/${total}`;$('progressFill').style.width=`${total?Math.round(done/total*100):0}%`;}
async function runTranslation(options={}){
 if(busy)return;
 if(!project.segments.length){toast('먼저 SRT 파일을 불러오세요.',true);return;}
 if(!activeApiKey()){toast(`${provider==='gemini'?'Gemini':'OpenAI'} API 키가 없습니다. 설정에서 등록하거나 수동 번역 교환을 이용하세요.`,true);switchView('settings');return;}
 const selectedProvider=provider,selectedKey=activeApiKey();
 const langs=options.language?[options.language]:project.selectedLanguages.filter(x=>x!==project.sourceLang);
 if(!langs.length){toast('번역할 언어를 한 개 이상 선택해 주세요.',true);return;}
 const chunks=[];
 for(const lang of langs){const list=options.segmentId?project.segments.filter(s=>s.id===options.segmentId):project.segments;
  for(let i=0;i<list.length;i+=20)chunks.push({lang,segments:list.slice(i,i+20)});
 }
 const countAffected=chunks.some(({lang,segments})=>segments.some(s=>project.translations[lang]?.[s.id]));
 if(countAffected&&!await confirmDialog('기존 번역 덮어쓰기','이미 작성된 일부 번역이 새로운 결과로 교체됩니다. 필요하다면 먼저 프로젝트를 백업하세요.','번역 실행'))return;
 if(options.segmentId&&!await confirmDialog('정밀 재번역 비용 확인',`선택한 자막을 ${provider==='gemini'?'Gemini':'GPT'} 정밀 모델로 다시 요청합니다. 개인 API에 이용 요금이 발생합니다.`,'정밀 재번역'))return;
 busy=true;controller=new AbortController();let done=0,tokens=0;const button=$('translateBtn');button.disabled=true;
 updateProgress(0,chunks.length,options.segmentId?'정밀 재번역':'일괄 번역');
 try{
  for(const chunk of chunks){
   if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');
   updateProgress(done,chunks.length,`${C.languageName(chunk.lang)} 번역 중`);
   const model=selectedProvider==='gemini'
    ?(options.segmentId?models.geminiQuality:models.geminiEconomy)
    :(options.segmentId?models.quality:models.economy);
   const adapter=selectedProvider==='gemini'?GEMINI:API;
   const {translation,usage}=await adapter.translateBatch({apiKey:selectedKey,model,segments:chunk.segments,sourceLang:project.sourceLang,targetLang:chunk.lang,style:project.style,glossary:project.glossary,signal:controller.signal});
   if(!project.translations[chunk.lang])project.translations[chunk.lang]={};Object.assign(project.translations[chunk.lang],translation);
   if(project.staleTranslations[chunk.lang])for(const s of chunk.segments)delete project.staleTranslations[chunk.lang][s.id];
   tokens+=usage?.total_tokens||0;done++;project.activeLanguage=chunk.lang;selectedId=chunk.segments[0]?.id||selectedId;persist();renderAll();updateProgress(done,chunks.length,`${C.languageName(chunk.lang)} 완료`);
  }
  toast(`번역 완료 · ${done}개 묶음 · API 보고 토큰 ${tokens.toLocaleString('ko-KR')}개`);
 }catch(e){if(e.name==='AbortError')toast(`번역이 중단됐습니다. 완료된 ${done}개 묶음은 유지됩니다.`);else toast(`${e.message} (완료된 ${done}개 묶음은 유지)`,true);
 }finally{busy=false;controller=null;button.disabled=false;$('translationProgress').hidden=true;renderAll();}
}
function markTranslationStale(id){project.staleTranslations ||= {};for(const lang of Object.keys(project.translations)){if(project.translations[lang]?.[id]){project.staleTranslations[lang] ||= {};project.staleTranslations[lang][id]=true;}}}
function linkFormEvents(){
 $('srtInput').addEventListener('change',e=>importSrt(e.target.files[0]));
 $('backupInput').addEventListener('change',e=>importBackup(e.target.files[0]));
 $('backupTop').addEventListener('click',backup);$('backupBtn').addEventListener('click',backup);$('settingsBackup').addEventListener('click',backup);
 $('triggerRestore').addEventListener('click',()=>$('backupInput').click());
 $('newProject').addEventListener('click',startFreshProject);
 $('loadDemo').addEventListener('click',loadSampleProject);
 $('loadDemoGuide').addEventListener('click',loadSampleProject);
 $('sourceLang').addEventListener('change',e=>{const old=project.sourceLang;project.sourceLang=e.target.value;project.selectedLanguages=project.selectedLanguages.filter(x=>x!==project.sourceLang);if(old!==project.sourceLang)project.activeLanguage=project.selectedLanguages[0]||'en';persist();renderAll();});
 $('stylePreset').addEventListener('change',e=>{project.style=e.target.value;persist();});
 $('presetStrip').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(b)applyPreset(C.PRESETS[b.dataset.preset]);});
 $('clearLanguages').addEventListener('click',()=>{project.selectedLanguages=[];persist();renderAll();});
 $('savePreset').addEventListener('click',()=>{if(!project.selectedLanguages.length){toast('프리셋을 만들 언어부터 선택하세요.',true);return;}const name=prompt('새 언어 프리셋 이름을 입력하세요 (20자 이내)');if(!name)return;const safe=name.trim().slice(0,20);if(!safe)return;userPresets[safe]=project.selectedLanguages.slice();savePresets();renderPresets();toast(`★ ${safe} 프리셋 저장 완료`);});
 const videoBox=$('videoBox'),videoInput=$('videoInput');
 function isVideoFile(file){return !!file&&(file.type.startsWith('video/')||(!file.type&&/\.(mp4|webm|mov|m4v|ogv|ogg)$/i.test(file.name)));}
 function loadVideoFile(file){
  if(!file)return;
  if(!isVideoFile(file)){toast('영상 파일만 선택할 수 있습니다. MP4, WebM 등을 확인해 주세요.',true);return;}
  const nextURL=URL.createObjectURL(file);const oldURL=videoURL;
  videoURL=nextURL;currentVideo=$('video');currentVideo.pause();currentVideo.src=nextURL;
  currentVideo.hidden=false;$('videoPlaceholder').hidden=true;$('videoFileName').textContent=file.name;
  currentVideo.load();renderVideoSubtitle();
  if(oldURL)URL.revokeObjectURL(oldURL);
  toast(`${file.name} 영상을 불러왔습니다.`);
 }
 videoInput.addEventListener('change',e=>{loadVideoFile(e.target.files?.[0]);videoInput.value='';});
 $('videoPlaceholder').addEventListener('click',()=>videoInput.click());
 function hasDraggedFiles(e){return Array.from(e.dataTransfer?.types||[]).includes('Files');}
 videoBox.addEventListener('dragenter',e=>{if(!hasDraggedFiles(e))return;e.preventDefault();videoBox.classList.add('is-dragover');});
 videoBox.addEventListener('dragover',e=>{if(!hasDraggedFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';videoBox.classList.add('is-dragover');});
 videoBox.addEventListener('dragleave',e=>{const r=videoBox.getBoundingClientRect();if(e.clientX<=r.left||e.clientX>=r.right||e.clientY<=r.top||e.clientY>=r.bottom)videoBox.classList.remove('is-dragover');});
 videoBox.addEventListener('drop',e=>{
  if(!hasDraggedFiles(e))return;
  e.preventDefault();videoBox.classList.remove('is-dragover');
  const files=Array.from(e.dataTransfer.files||[]);
  if(files.length!==1){toast('한 번에 영상 파일 하나만 넣어 주세요.',true);return;}
  loadVideoFile(files[0]);
 });
 document.addEventListener('dragover',e=>{if(hasDraggedFiles(e))e.preventDefault();});
 document.addEventListener('drop',e=>{if(!hasDraggedFiles(e))return;e.preventDefault();videoBox.classList.remove('is-dragover');if(!videoBox.contains(e.target))toast('영상은 미리보기 중앙 영역에 끌어놓아 주세요.',true);});
 document.addEventListener('dragend',()=>videoBox.classList.remove('is-dragover'));
 $('video').addEventListener('error',()=>{if(videoURL)toast('이 브라우저에서 해당 영상 코덱을 재생할 수 없습니다. MP4(H.264) 또는 WebM을 권장합니다.',true);});
 window.addEventListener('beforeunload',()=>{if(videoURL)URL.revokeObjectURL(videoURL);});
 $('video').addEventListener('timeupdate',renderVideoSubtitle);$('video').addEventListener('seeked',renderVideoSubtitle);$('video').addEventListener('play',renderVideoSubtitle);
 $('translateBtn').addEventListener('click',()=>runTranslation());$('cancelTranslate').addEventListener('click',()=>controller?.abort());
 $('downloadCurrent').addEventListener('click',exportCurrent);$('downloadAll').addEventListener('click',exportAll);
 all('.filter-button').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;all('.filter-button').forEach(x=>x.classList.toggle('active',x===b));renderCueList();}));
 $('sourceText').addEventListener('input',e=>{const s=project.segments.find(s=>s.id===selectedId);if(!s)return;s.text=e.target.value;markTranslationStale(s.id);persist();renderReviewBox(s.id);});
 $('sourceText').addEventListener('blur',()=>{renderCueList();renderDetail();});
 $('translatedText').addEventListener('input',e=>{const lang=currentLanguage();project.translations[lang] ||= {};project.translations[lang][selectedId]=e.target.value;project.staleTranslations[lang] ||= {};delete project.staleTranslations[lang][selectedId];persist();renderReviewBox(selectedId);$('statIssues').innerHTML=`${quality().issues.length}<span>건 발견</span>`;});
 $('translatedText').addEventListener('blur',()=>{renderCueList();renderDetail();});
 $('retranslateOne').addEventListener('click',()=>runTranslation({segmentId:selectedId,language:currentLanguage()}));
 $('manualLanguage').addEventListener('change',updateManualPrompt);
 $('manualPrev').addEventListener('click',()=>{manualStart-=30;updateManualPrompt();});
 $('manualNext').addEventListener('click',()=>{manualStart+=30;updateManualPrompt();});
 $('copyPrompt').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('manualPrompt').value);toast('번역 요청문을 클립보드에 복사했습니다.');}catch{const ta=$('manualPrompt');ta.focus();ta.select();toast('자동 복사가 제한됐습니다. 선택된 내용을 직접 복사하세요.',true);}});
 $('applyManual').addEventListener('click',()=>{const lang=$('manualLanguage').value,expected=manualSegmentBatch().map(s=>s.id);try{if(!expected.length)throw new Error('번역할 자막이 없습니다.');const map=C.parseTranslationJson($('manualResult').value,expected,false);if(!Object.keys(map).length)throw new Error('적용할 번역이 없습니다.');project.translations[lang] ||= {};Object.assign(project.translations[lang],map);project.staleTranslations[lang] ||= {};for(const id of Object.keys(map))delete project.staleTranslations[lang][id];
  if(!project.selectedLanguages.includes(lang))project.selectedLanguages.push(lang);project.activeLanguage=lang;persist();renderAll();toast(`${Object.keys(map).length}개 자막을 적용했습니다. 누락된 번역은 검수 알림에 표시됩니다.`);switchView('studio');}catch(e){toast(e.message,true);}});
 $('toggleKey').addEventListener('click',()=>{$('apiKeyInput').type=$('apiKeyInput').type==='password'?'text':'password';$('toggleKey').textContent=$('apiKeyInput').type==='password'?'보기':'숨기기';});
 $('applyKey').addEventListener('click',()=>{const value=$('apiKeyInput').value.trim();if(!value||value.length<15){toast('API 키를 정확히 입력하세요.',true);return;}apiKey=value;$('apiKeyInput').value='';selectProvider('openai');toast('OpenAI 키를 등록하고 번역 엔진을 OpenAI로 선택했습니다. 실제 연결은 번역 시 검증됩니다.');});
 $('forgetKey').addEventListener('click',()=>{apiKey='';$('apiKeyInput').value='';updateApiStatus();toast('메모리에 있던 API 키를 잠갔습니다. 암호화된 저장본은 유지됩니다.');});
 $('encryptKey').addEventListener('click',async()=>{try{const key=apiKey||$('apiKeyInput').value.trim();if(!key)throw new Error('저장할 API 키가 없습니다. 먼저 키를 입력하세요.');await SEC.saveKey(key,$('secretPassword').value);apiKey=key;$('apiKeyInput').value='';$('secretPassword').value='';selectProvider('openai');toast('OpenAI 키를 암호화 저장하고 현재 탭에서 사용하도록 설정했습니다.');}catch(e){toast(e.message,true);}});
 $('unlockKey').addEventListener('click',async()=>{try{apiKey=await SEC.loadKey($('secretPassword').value);$('secretPassword').value='';selectProvider('openai');toast('OpenAI 키를 잠금 해제하고 OpenAI 번역 엔진을 선택했습니다.');}catch(e){toast(e.message,true);}});
 $('clearSavedKey').addEventListener('click',async()=>{if(!await confirmDialog('암호화 저장본 삭제','브라우저에 저장된 암호화 API 키를 삭제합니다. 현재 탭의 메모리 키는 유지됩니다.','저장본 삭제'))return;SEC.clearKey();updateApiStatus();toast('암호화 저장본이 삭제됐습니다.');});
 // Gemini keys are managed independently and never included in project backups.
 $('providerSelect').addEventListener('change',()=>selectProvider($('providerSelect').value));
 $('geminiToggleKey').addEventListener('click',()=>{$('geminiKeyInput').type=$('geminiKeyInput').type==='password'?'text':'password';$('geminiToggleKey').textContent=$('geminiKeyInput').type==='password'?'보기':'숨기기';});
 $('geminiApplyKey').addEventListener('click',()=>{const value=$('geminiKeyInput').value.trim();if(value.length<15){toast('Gemini API 키를 정확히 입력하세요.',true);return;}geminiKey=value;$('geminiKeyInput').value='';selectProvider('gemini');toast('Gemini 키를 등록하고 번역 엔진을 Gemini로 선택했습니다. 실제 연결은 번역 시 검증됩니다.');});
 $('geminiForgetKey').addEventListener('click',()=>{geminiKey='';$('geminiKeyInput').value='';updateApiStatus();toast('Gemini 메모리 키가 잠겼습니다.');});
 $('geminiEncryptKey').addEventListener('click',async()=>{try{const key=geminiKey||$('geminiKeyInput').value.trim();if(!key)throw new Error('저장할 Gemini API 키가 없습니다.');await SEC.saveKey(key,$('geminiPassword').value,'gemini');geminiKey=key;$('geminiKeyInput').value='';$('geminiPassword').value='';selectProvider('gemini');toast('Gemini 키를 암호화 저장하고 현재 탭에서 사용하도록 설정했습니다.');}catch(e){toast(e.message,true);}});
 $('geminiUnlockKey').addEventListener('click',async()=>{try{geminiKey=await SEC.loadKey($('geminiPassword').value,'gemini');$('geminiPassword').value='';selectProvider('gemini');toast('Gemini 키를 잠금 해제하고 Gemini 번역 엔진을 선택했습니다.');}catch(e){toast(e.message,true);}});
 $('geminiClearSavedKey').addEventListener('click',async()=>{if(!await confirmDialog('Gemini 저장본 삭제','Gemini 키의 암호화 저장본만 삭제합니다. 메모리에 있는 키는 유지됩니다.','삭제'))return;SEC.clearKey('gemini');updateApiStatus();toast('Gemini 키 저장본을 삭제했습니다.');});
 $('saveSettings').addEventListener('click',()=>{storeModelInputs();project.glossary=$('glossary').value;try{localStorage.setItem(MODELS_KEY,JSON.stringify(models));}catch{}persist();toast('선택한 AI의 번역 모델과 용어 설정을 저장했습니다.');});
 $('resetProject').addEventListener('click',startFreshProject);
}
async function startFreshProject(){
 if(project.segments.length&&!await confirmDialog('새 프로젝트 만들기','현재 자막과 번역을 비우고 새 작업을 시작합니다. 필요하다면 먼저 프로젝트 백업을 다운로드하세요.','새 프로젝트'))return;
 project=blankProject();selectedId=null;manualStart=0;persist();renderAll();switchView('studio');toast('빈 프로젝트가 준비됐습니다. SRT 파일을 불러오세요.');
}
async function loadSampleProject(){
 if(project.segments.length&&!await confirmDialog('예제 프로젝트 열기','현재 작업을 연습용 미드나잇 시그널 샘플로 교체합니다. 현재 내용을 보존하려면 먼저 백업하세요.','예제 열기'))return;
 project=C.makeDemoProject();project.demoOpenedExplicitly=true;selectedId=project.segments[0]?.id||null;manualStart=0;persist();renderAll();switchView('studio');toast('체험용 예제입니다. 영어·일본어에만 예시 번역이 들어 있습니다.');
}
function init(){addOptions($('sourceLang'),C.LANGUAGES);bindNav();linkFormEvents();renderAll();renderSettings();if(migratedExample)toast('기존의 수정되지 않은 체험용 예제를 닫았습니다. 새 SRT를 불러오세요.');}

init();
})();
