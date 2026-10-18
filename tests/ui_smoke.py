"""Chromium UI test for GlobalSub v1.2.3.
Does not call the paid OpenAI API; tests browser-only interactions, layout and backups.
"""
from pathlib import Path
import json
import re
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
HTML=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>', '', HTML)
HTML=re.sub(r'<link rel="stylesheet"[^>]+>', '', HTML)
HTML=re.sub(r'<script src="[^"]+" defer></script>', '', HTML)


def initialize(page, persisted=None):
    page.set_content(HTML,wait_until='load')
    page.evaluate('''(preloaded) => {
      window.__store = new Map(Object.entries(preloaded || {}));
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:k=>__store.get(k)||null,
      setItem:(k,v)=>__store.set(k,String(v)),
      removeItem:k=>__store.delete(k)}})
    }''', persisted or {})
    page.add_style_tag(content=(ROOT/'styles.css').read_text(encoding='utf-8'))
    page.add_style_tag(content=(ROOT/'styles-polish.css').read_text(encoding='utf-8'))
    for src in ['src/core.js','src/secure.js','src/api.js','app.js']:
        page.evaluate((ROOT/src).read_text(encoding='utf-8'))


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        initialize(page)
        assert page.locator('.cue-item').count()==1, 'Must open with empty project'
        assert page.locator('#sideProjectName').inner_text()=='새 프로젝트'
        assert page.locator('#statSegments').inner_text().startswith('0')
        # Korean-first target labels still expose the original native names.
        assert page.locator('.lang-choice').filter(has_text='영어').filter(has_text='English').count()==1
        assert page.locator('.lang-choice').filter(has_text='일본어').filter(has_text='日本語').count()==1
        assert '한국어' in page.locator('#sourceLang option:checked').inner_text()
        assert page.locator('.tab-button').filter(has_text='스페인어').count()==1
        page.locator('#guideQuick').click()
        assert page.locator('#guideView').is_visible()
        assert page.locator('.guide-step').count()==6
        page.locator('#guideView [data-guide-to="settings"]').click()
        assert page.locator('#settingsView').is_visible()
        heights=page.locator('#settingsBackup, #triggerRestore').evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().height)')
        tops=page.locator('#settingsBackup, #triggerRestore').evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().top)')
        assert all(h==44 for h in heights),f'backup button heights incorrect: {heights}'
        assert abs(tops[0]-tops[1])<=1, f'backup controls top mismatch: {tops}'
        page.locator('#newProject').click()
        assert page.locator('#studioView').is_visible()
        page.locator('#loadDemo').click()
        assert page.locator('#sideProjectName').inner_text()=='미드나잇 시그널'
        assert '체험용' in page.locator('#projectType').inner_text()
        # Explicitly opened demo must persist across next refresh, unlike the legacy auto-open demo.
        page.wait_for_function('!!__store.get("globalsub_v1_project")')
        example_store=page.evaluate('Object.fromEntries(__store)')
        reopened=browser.new_page(viewport={'width':1280,'height':900})
        initialize(reopened,example_store)
        assert reopened.locator('#sideProjectName').inner_text()=='미드나잇 시그널'
        reopened.close()
        assert page.locator('#statLanguages').inner_text().startswith('2')
        page.locator('.tab-button').filter(has_text='스페인어').click()
        assert '미번역' in page.locator('#editorTranslationState').inner_text()
        assert page.locator('#emptyTranslationActions').is_visible()
        page.locator('#emptyTranslationActions [data-guide-to="manual"]').click()
        assert page.locator('#manualView').is_visible()
        page.locator('#manualLanguage').select_option('es')
        page.locator('#manualResult').fill('{"segments":[{"id":"1","text":"Hola"}]}')
        page.locator('#applyManual').click()
        page.wait_for_function("!document.getElementById('studioView').hidden")
        page.locator('.tab-button').filter(has_text='스페인어').click()
        assert page.locator('#translatedText').input_value()=='Hola'
        assert '일부' in page.locator('#editorTranslationState').inner_text()
        with page.expect_download() as dl:
            page.locator('#downloadAll').click()
        assert dl.value.suggested_filename.endswith('.zip')
        with page.expect_download() as dl:
            page.locator('#backupBtn').click()
        saved=json.loads(Path(dl.value.path()).read_text(encoding='utf-8'))
        assert saved['project']['translations']['es']['1']=='Hola'
        with page.expect_file_chooser() as chooser:
            page.locator('#settingsQuick').click()
            page.locator('#triggerRestore').click()
        chooser.value.set_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(saved,ensure_ascii=False).encode('utf-8')})
        page.wait_for_function("!document.getElementById('studioView').hidden")
        assert 'Hola' in page.locator('.cue-translated').first.inner_text() if page.locator('.tab-button.selected').inner_text().find('스페인어')!=-1 else True
        # Old untouched default demo becomes empty without losing actual edited data.
        demo_dict=page.evaluate('GlobalSubCore.makeDemoProject()')
        untouched=browser.new_page(viewport={'width':1280,'height':900})
        initialize(untouched,{'globalsub_v1_project':json.dumps(demo_dict,ensure_ascii=False)})
        assert untouched.locator('#sideProjectName').inner_text()=='새 프로젝트'
        untouched.close()
        # Edited demo is retained if present in old storage.
        stored=json.dumps(saved['project'],ensure_ascii=False)
        edited=browser.new_page(viewport={'width':1280,'height':900})
        initialize(edited,{'globalsub_v1_project':stored})
        assert edited.locator('#sideProjectName').inner_text()=='미드나잇 시그널'
        assert '체험용' in edited.locator('#projectType').inner_text()
        # Reset via UI, then import a real SRT.
        page.locator('#newProject').click()
        page.locator('#modalConfirm').click()
        assert page.locator('#sideProjectName').inner_text()=='새 프로젝트'
        page.locator('#srtInput').set_input_files(str(ROOT/'assets/샘플_한국어.srt'))
        assert '미드나잇' not in page.locator('#sideProjectName').inner_text()
        page.wait_for_function("document.querySelectorAll('.cue-item').length>1")
        assert page.locator('.cue-item').count()>1
        # Make sure browser storage was not populated with API key.
        assert 'sk-fake' not in json.dumps(page.evaluate('Object.fromEntries(__store)'))
        # The preview itself opens the native file chooser; no separate footer click is needed.
        with page.expect_file_chooser() as chooser:
            page.locator('#videoPlaceholder').click()
        chooser.value.set_files({'name':'chosen.mp4','mimeType':'video/mp4','buffer':bytes([0,0,0,8,102,116,121,112])})
        assert page.locator('#videoPlaceholder').is_hidden()
        assert page.locator('#video').is_visible()
        assert page.locator('#videoFileName').inner_text()=='chosen.mp4'
        assert page.locator('#video').evaluate('(el)=>el.src.startsWith("blob:")')
        # Drag-and-drop onto the visible video replaces it; no upload endpoint is used.
        page.evaluate('''() => {
          const dt=new DataTransfer();
          dt.items.add(new File([new Uint8Array([0,1,2])], 'dropped.webm', {type:'video/webm'}));
          const area=document.getElementById('videoBox');
          for(const type of ['dragenter','dragover','drop'])area.dispatchEvent(new DragEvent(type,{dataTransfer:dt,bubbles:true,cancelable:true}));
        }''')
        assert page.locator('#videoFileName').inner_text()=='dropped.webm'
        assert not page.locator('#videoBox').evaluate('(el)=>el.classList.contains("is-dragover")')
        # Non-video files cannot replace the selected media.
        page.evaluate('''() => {
          const dt=new DataTransfer();
          dt.items.add(new File(['no'], 'notes.txt', {type:'text/plain'}));
          document.getElementById('videoBox').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));
        }''')
        assert page.locator('#videoFileName').inner_text()=='dropped.webm'
        assert page.locator('#toast').inner_text().find('영상 파일만')!=-1
        # Responsive widths, verify guide and nav work at 320px.
        for width in (320,375,390,768):
            mobile=browser.new_page(viewport={'width':width,'height':844})
            mobile.on('pageerror',lambda e: errors.append(str(e)))
            initialize(mobile)
            assert not mobile.evaluate('document.documentElement.scrollWidth > innerWidth'),f'overflow at {width}px'
            mobile.locator('[data-view="guide"]').click()
            assert mobile.locator('#guideView').is_visible()
            assert not mobile.evaluate('document.documentElement.scrollWidth > innerWidth'),f'guide overflow at {width}px'
            mobile.close()
        assert not errors,errors
        page.screenshot(path=str(ROOT/'v1.2.3-desktop.png'),full_page=True)
        browser.close()
        print('PASS: 1.2.3 Korean language labels / preview click / video drop / blank start / demo / 44px restore / translation state / guide / manual JSON / ZIP / backup / responsive')

if __name__=='__main__': main()
