"""Mocked Gemini-only browser integration. Never requests a paid API."""
import json
import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
from ui_smoke import initialize, ROOT

with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1280,'height':900},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    initialize(page)
    page.locator('#settingsQuick').click()
    page.locator('#providerSelect').select_option('gemini')
    assert page.locator('#economyModel').input_value()=='gemini-3.5-flash-lite'
    assert page.locator('#qualityModel').input_value()=='gemini-3.8-flash'
    page.locator('#geminiKeyInput').fill('fake-gemini-key-000000000')
    page.locator('#geminiApplyKey').click()
    assert 'Gemini 키 사용 중' in page.locator('#apiStatus').inner_text()
    page.locator('#saveSettings').click()
    page.evaluate('''() => {
      window.__geminiRequests=[];
      const oldFetch=window.fetch;
      window.fetch=async (url,config) => {
        if(String(url).includes('generativelanguage.googleapis.com')){
          window.__geminiRequests.push({url,config});
          const body=JSON.parse(config.body);
          const s=body.contents[0].parts[0].text;
          const segments=JSON.parse(s.split('Subtitles:\\n')[1]);
          return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({segments:segments.map(x=>({id:x.id,text:'Gemini translation '+x.id}))})}]}}],usageMetadata:{totalTokenCount:12}})};
        }
        return oldFetch(url,config);
      };
    }''')
    page.locator('#loadDemo').click()
    for checkbox in page.locator('#languageChoices input[type="checkbox"]').all():
        if checkbox.input_value()=='es' and not checkbox.is_checked():checkbox.check()
        elif checkbox.input_value()!='es' and checkbox.is_checked():checkbox.uncheck()
    page.locator('#translateBtn').click()
    # Sample has a Spanish tab with four cues; only one request expected.
    if page.locator('#modalConfirm').is_visible():page.locator('#modalConfirm').click()
    page.wait_for_function("(window.__geminiRequests||[]).length===1 && document.getElementById('translationProgress').hidden", timeout=15000)
    req=page.evaluate('''() => __geminiRequests.map(x=>({url:x.url,key:x.config.headers['x-goog-api-key'],body:JSON.parse(x.config.body)}))''')[0]
    assert req['url'].endswith('gemini-3.5-flash-lite:generateContent')
    assert req['key']=='fake-gemini-key-000000000'
    page.locator('.tab-button').filter(has_text='스페인어').click()
    assert 'Gemini translation 1' in page.locator('#translatedText').input_value()
    assert page.locator('#statLanguages').inner_text().startswith('3')
    # Project backup may not store any API key.
    with page.expect_download() as dl:page.locator('#backupBtn').click()
    contents=Path(dl.value.path()).read_text()
    assert 'fake-gemini-key-000000000' not in contents
    # Switch provider and verify existing OpenAI models and status do not inherit Gemini key.
    page.locator('#settingsQuick').click()
    page.locator('#providerSelect').select_option('openai')
    assert page.locator('#economyModel').input_value()=='gpt-4.1-mini'
    assert 'OpenAI API 미연결' in page.locator('#apiStatus').inner_text()
    assert 'fake-gemini-key-000000000' not in json.dumps(page.evaluate('Object.fromEntries(__store)'))
    assert not errors,errors
    b.close()
    print('PASS: Gemini provider switch / model defaults / user key / direct mock translation / ID matching / key isolation / backups')
