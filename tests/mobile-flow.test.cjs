const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const expected=require('./fixtures/narration-0916.json'),base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8766';
async function background(p,role='public'){
 assert.equal(await p.locator('.screening-section input:checked').count(),0);
 assert.equal(await p.locator('[name=backgroundChoice]').count(),4);
 await p.locator('#consent-checkbox').check();await p.locator(`[name=backgroundChoice][value=${role==='judge'?'judge':role==='lawyer'?'lawyer':'other'}]`).check();await p.locator('#start-study').click();await p.locator('#role-dialog[open]').waitFor();
}
async function orient(p){await p.evaluate(()=>{document.querySelector('#role-dialog').close();state.orientation[state.caseType]={version:STUDY_ROLE_MEDIA.version,completed:true,videoCompleted:true,videoMax:18,visibleMs:18000};});}
async function dossier(p){
 for(const tab of ['overview','evidence','task']){
  assert.equal(await p.evaluate(()=>state.activeDossierTab),tab);
  assert.doesNotMatch(await p.locator('#dossier-content').textContent(),/未提供|不补造|原材料|原始案号/);
  await p.locator('#dossier-content').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await p.clock.runFor(8250);await p.locator('#dossier-confirm').check();assert.equal(await p.locator('#to-replay').isEnabled(),true);await p.locator('#to-replay').click();
 }
 await p.locator('#screen-replay.active').waitFor();
}
async function finish(p){
 await p.locator('#transcript-confirm').check();await p.locator('#to-decision').click();await p.locator('#to-survey').click();
 await p.locator('#review-ai-participation').click();await p.locator('#screen-replay.active').waitFor();assert.equal(await p.locator('#condition-disclosure').isVisible(),true);assert.equal(await p.locator('.ai-inline-node').count()>0,true);await p.locator('#return-to-survey').click();await p.locator('#screen-survey.active').waitFor();
 assert.equal(await p.locator('input[name=fairness]').inputValue(),'');assert.equal(await p.locator('input[name=involvement]').inputValue(),'');assert.equal(await p.locator('[data-rating=fairness]').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);assert.ok((await p.locator('[data-rating=fairness] .unsure-option').boundingBox()).y>(await p.locator('[data-rating=fairness] .range-shell').boundingBox()).y);
 for(const id of ['judge','court','provider','system'])await p.locator('#responsibility-score-'+id).fill('50');await p.locator('#to-allocation').click();
 for(const id of ['judge','court','provider','system'])await p.locator('#responsibility-allocation-'+id).fill('25');
 await p.locator('[name=manipulationCheck]').selectOption('none');await p.locator('[name=finalSigner]').selectOption('judge');await p.locator('[name=honestConfirm]').check();
 await p.locator('#submit-evaluation').click();assert.match(await p.locator('#survey-error').textContent(),/感受题/);
 for(const field of await p.locator('[data-rating]').all())await field.locator('[data-score="4"]').click();
 assert.equal(await p.locator('[name=fairness]').inputValue(),'4');await p.locator('[data-rating=fairness] [data-unsure]').check();assert.equal(await p.locator('[name=fairness]').inputValue(),'unsure');await p.locator('[data-rating=fairness] [data-score="6"]').click();assert.equal(await p.locator('[data-rating=fairness] [data-unsure]').isChecked(),false);
 await p.reload();await p.locator('#screen-survey.active').waitFor();assert.equal(await p.locator('[name=fairness]').inputValue(),'6');assert.match(await p.locator('#feedback-fairness').textContent(),/6 分，同意/);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.locator('#rating-list').screenshot({path:'../../work/mobile-sliders.png'});
 await p.locator('#submit-evaluation').click();
}
function wav(){const n=24000*6,buf=Buffer.alloc(44+n*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(24000,24);buf.writeUInt32LE(48000,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*2,40);return buf;}
(async()=>{const b=await chromium.launch({headless:true});try{
 const c=await b.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 Mobile MicroMessenger/8.0'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();
 await p.goto(base+'/?view=participant&preview=1&role=public&condition=substantive&case=natural');assert.match(await p.locator('#consent-checkbox').locator('..').textContent(),/本次实验/);await background(p);await orient(p);
 for(const type of ['natural','statutory']){
  await dossier(p);assert.match(await p.locator('#condition-disclosure').textContent(),/实质性参与/);assert.equal(await p.locator('.ai-disclosure-title').isVisible(),true);
  const full=expected[type].join('');await p.clock.runFor(3000);const part=await p.locator('#narration-text').textContent();assert.ok(part.length>20&&part.length<full.length);assert.equal(await p.locator('#transcript-confirm').isDisabled(),true);
  await p.clock.runFor(12500);assert.deepEqual(await p.locator('#narration-text p').allTextContents(),expected[type]);await p.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await p.locator('.narration-record').screenshot({path:'../../work/ai-disclosure-progressive-mobile.png'});
  await finish(p);
  if(type==='natural'){await p.locator('#screen-between.active').waitFor();await p.locator('#next-case').click();await orient(p);}else await p.locator('#screen-debrief.active').waitFor();
 }
 const records=await p.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)));assert.equal(records[0].responses.length,2);assert.equal(records[0].responses[0].ratings.fairness,6);assert.equal(records[0].responses[0].involvement,4);assert.equal(records[0].responses[0].presentation,'shared_progressive_text');assert.deepEqual(errors,[]);
 await c.close();console.log('Passed mobile two-case workflow: no defaults, next-section buttons, progressive text, visible AI cue, unanswered sliders, refresh and saved scores.');
 // WeChat alternative opens the keyboard entry without falsely requesting unsupported browser recognition.
 const cw=await b.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 Mobile MicroMessenger/8.0'}),w=await cw.newPage();await w.goto(base+'/?view=participant&preview=1&role=public');await background(w);await orient(w);await w.evaluate(()=>setStep('survey'));assert.equal(await w.locator('#speech-start').isVisible(),false);await w.locator('#speech-keyboard').click();assert.equal(await w.locator('#open-response').evaluate(e=>e===document.activeElement),true);assert.match(await w.locator('#speech-status').textContent(),/手机键盘/);assert.equal(await w.evaluate(()=>speech.getMetadata().attempts),0);await w.locator('#open-response').fill('测试语音输入后核对的文字');assert.equal(await w.locator('#open-response-confirm-row').isVisible(),true);await cw.close();
 // Real test audio, never shipped, drives partial/full disclosure and pause/resume.
 const ca=await b.newContext({viewport:{width:390,height:844}}),a=await ca.newPage();await a.clock.install();
 await a.route('**/audio-config.js*',r=>r.fulfill({contentType:'application/javascript',body:"window.STUDY_AUDIO_VERSION=StudyNarration.VERSION;window.STUDY_AUDIO={natural:'./test-natural.wav',statutory:'./test-statutory.wav'};"}));await a.route('**/test-*.wav',r=>r.fulfill({contentType:'audio/wav',body:wav()}));
 await a.goto(base+'/?view=participant&preview=1&role=judge&condition=decisional&case=natural');await background(a,'judge');assert.equal(await a.evaluate(()=>state.role),'judge');await orient(a);await dossier(a);
 assert.match(await a.locator('#condition-disclosure').textContent(),/决定性参与/);assert.match(await a.locator('#narration-text').textContent(),/点击/);await a.locator('#playback-toggle').click();await a.waitForFunction(()=>state.audio.positionSeconds>1.5);await a.locator('#playback-toggle').click();const partial=await a.locator('#narration-text').textContent();assert.ok(partial.length>40&&partial.length<expected.natural.join('').length);await a.clock.runFor(10000);assert.equal(await a.locator('#narration-text').textContent(),partial);assert.equal(await a.locator('#transcript-confirm').isDisabled(),true);
 await a.locator('#playback-toggle').click();await a.waitForFunction(()=>state.audio.completed);assert.deepEqual(await a.locator('#narration-text p').allTextContents(),expected.natural);assert.equal(await a.locator('#transcript-confirm').isEnabled(),true);await a.locator('#playback-restart').click();assert.ok((await a.locator('#narration-text').textContent()).length<expected.natural.join('').length);await ca.close();
 console.log('Passed WeChat keyboard-entry fallback and actual audio-driven progressive text, pause, finish and restart.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
