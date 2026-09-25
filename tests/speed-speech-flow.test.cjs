const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8775';
async function setup(p){
 await p.goto(base+'/?view=participant&preview=1&role=judge&case=natural&condition=procedural');await p.locator('#consent-checkbox').check();await p.locator('[name=backgroundChoice][value=judge]').check();await p.locator('#start-study').click();await p.locator('#role-dialog[open]').waitFor();
 await p.evaluate(()=>{document.querySelector('#role-dialog').close();state.orientation[state.caseType]={version:STUDY_ROLE_MEDIA.version,completed:true,videoCompleted:true,visibleMs:18000};state.reading=Object.fromEntries(StudyCore.DOSSIER_TABS.map(k=>[k,{confirmed:true,reachedEnd:true,visibleMs:8000}]));setStep('replay');});
 await p.waitForFunction(()=>document.querySelector('#judgment-audio').readyState>=2);
}
(async()=>{const b=await chromium.launch({headless:true});try{
 const c=await b.newContext({viewport:{width:390,height:844}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await setup(p);
 assert.equal(await p.locator('#playback-speed').inputValue(),'1.5');assert.equal(await p.evaluate(()=>document.querySelector('#judgment-audio').playbackRate),1.5);
 await p.locator('#playback-toggle').click();await p.waitForTimeout(2200);await p.locator('#playback-toggle').click();
 const position=await p.evaluate(()=>state.audio.positionSeconds);assert.ok(position>2.7&&position<5,position);assert.equal(await p.locator('#transcript-confirm').isDisabled(),true);
 assert.deepEqual(await p.locator('#narration-text p').allTextContents(),await p.evaluate(()=>StudyPlayback.reveal(StudyNarration.paragraphsFor(state.caseType,state.condition),StudyPlayback.fraction(state.replay.textVisibleMs,StudyNarration.MIN_TEXT_MS))));
 await p.locator('#playback-speed').selectOption('1');assert.equal(await p.evaluate(()=>state.audio.playbackRate),1);assert.equal(await p.evaluate(()=>document.querySelector('#judgment-audio').preservesPitch),true);
 await p.reload();await p.locator('#screen-replay.active').waitFor();await p.waitForFunction(()=>pendingAudioPosition===null);assert.equal(await p.locator('#playback-speed').inputValue(),'1');assert.equal(await p.evaluate(()=>document.querySelector('#judgment-audio').playbackRate),1);
 await p.locator('#playback-restart').click();await p.waitForTimeout(300);await p.locator('#playback-toggle').click();assert.equal(await p.evaluate(()=>state.audio.playbackRate),1);
 await p.locator('#playback-speed').selectOption('1.5');await p.locator('.narration-record').screenshot({path:'../audio-0923/speed-0925-mobile.png'});
 await p.evaluate(()=>{state.audio={};state.replay={};state.caseType='statutory';renderTranscript();});await p.waitForFunction(()=>document.querySelector('#judgment-audio').readyState>=2);assert.equal(await p.evaluate(()=>state.audio.playbackRate),1.5);assert.match(await p.locator('#judgment-audio').getAttribute('src'),/statutory-procedural/);// The audio remains incomplete, but the reading gate can finish independently.
 await p.clock.runFor(15250);await p.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});assert.equal(await p.locator('#transcript-confirm').isEnabled(),true);assert.equal(await p.evaluate(()=>Boolean(state.audio.completed)),false);
 await p.locator('#playback-toggle').click();await p.locator('#transcript-confirm').check();await p.locator('#to-decision').click();await p.locator('#screen-decision.active').waitFor();assert.equal(await p.locator('#judgment-audio').evaluate(e=>e.paused),true);
 assert.deepEqual(errors,[]);await c.close();
 console.log('Passed 1.5x, independent fast text, speed persistence, incomplete-audio continuation and pause on navigation.');
 // Every case/condition reveals all matching text without requiring audio playback.
 const all=await b.newContext({viewport:{width:390,height:844}}),q=await all.newPage();await q.clock.install();await setup(q);
 for(const caseType of ['natural','statutory'])for(const condition of ['none','procedural','substantive','decisional']){
  await q.evaluate(({caseType,condition})=>{state.caseType=caseType;state.condition=condition;state.replay={};state.audio={};renderTranscript();setStep('replay');exposureTick=performance.now();},{caseType,condition});
  await q.clock.runFor(14000);assert.equal(await q.locator('#transcript-confirm').isDisabled(),true);
  await q.clock.runFor(1250);await q.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});
  assert.deepEqual(await q.locator('#narration-text p').allTextContents(),await q.evaluate(()=>StudyNarration.paragraphsFor(state.caseType,state.condition)));assert.equal(await q.locator('#transcript-confirm').isEnabled(),true);assert.equal(await q.evaluate(()=>Boolean(state.audio.started)),false);assert.equal(await q.locator('.ai-inline-node').count(),1);
 }
 await all.close();console.log('Passed eight independent 15-second reading gates without audio playback.');
 const full=await b.newContext(),r=await full.newPage();await r.clock.install();await setup(r);
 for(let trial=0;trial<2;trial++){
  await r.clock.runFor(15250);await r.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await r.locator('#transcript-confirm').check();await r.locator('#to-decision').click();await r.locator('#to-survey').click();
  for(const id of ['judge','court','provider','system'])await r.locator('#responsibility-score-'+id).fill('50');await r.locator('#to-allocation').click();for(const id of ['judge','court','provider','system'])await r.locator('#responsibility-allocation-'+id).fill('25');
  for(const field of await r.locator('[data-rating]').all())await field.locator('[data-score="4"]').click();await r.locator('[name=manipulationCheck]').selectOption('procedural');await r.locator('[name=finalSigner]').selectOption('judge');await r.locator('[name=honestConfirm]').check();await r.locator('#submit-evaluation').click();
  if(trial===0){await r.locator('#screen-between.active').waitFor();await r.locator('#next-case').click();await r.locator('#role-dialog[open]').waitFor();await r.evaluate(()=>{document.querySelector('#role-dialog').close();state.orientation[state.caseType]={version:STUDY_ROLE_MEDIA.version,completed:true,videoCompleted:true,visibleMs:18000};state.reading=Object.fromEntries(StudyCore.DOSSIER_TABS.map(k=>[k,{confirmed:true,reachedEnd:true,visibleMs:8000}]));setStep('replay');});assert.equal(await r.locator('#transcript-confirm').isDisabled(),true);}
 }
 await r.locator('#screen-debrief.active').waitFor();const answers=await r.evaluate(()=>state.session.responses);assert.equal(answers.length,2);for(const a of answers){assert.equal(a.presentation,'condition_audio_fast_text');assert.equal(a.replayCompleted,true);assert.equal(Boolean(a.audio.completed),false);assert.equal(a.audio.playbackRate,1.5);assert.ok(a.playback.textVisibleMs>=15000);}await full.close();console.log('Passed two-case submission with honest incomplete-audio metadata.');
 for(const wechat of [true,false,'safari']){
  const c=await b.newContext({viewport:{width:390,height:844},userAgent:wechat==='safari'?'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15':wechat?'Mozilla/5.0 Mobile MicroMessenger/8.0':'Mozilla/5.0 Mobile'}),p=await c.newPage();
  await p.addInitScript(()=>{window.recognitionStarts=0;window.SpeechRecognition=class{start(){window.recognitionStarts++}abort(){}stop(){}};});await p.clock.install();await setup(p);await p.evaluate(()=>setStep('survey'));await p.locator('#open-response').fill('保留原回答');
  if(wechat===true){assert.equal(await p.locator('#speech-start').isVisible(),false);assert.match(await p.locator('#speech-status').textContent(),/未接入/);}
  else{await p.locator('#speech-start').click();await p.clock.runFor(12001);assert.match(await p.locator('#speech-status').textContent(),/启动超时/);assert.equal(await p.locator('#speech-start').isEnabled(),true);}
  if(wechat==='safari'){assert.match(await p.locator('#speech-platform-help').textContent(),/系统设置.*键盘.*听写/);assert.match(await p.locator('#speech-keyboard').textContent(),/Mac/);}
  await p.locator('#speech-keyboard').click();assert.equal(await p.locator('#open-response').evaluate(e=>e===document.activeElement),true);assert.equal(await p.locator('#open-response').inputValue(),'保留原回答');if(wechat===true)assert.equal(await p.evaluate(()=>window.recognitionStarts),0);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await c.close();
 }
 console.log('Passed WeChat truthful keyboard fallback and browser startup-timeout recovery with original answer retained.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
