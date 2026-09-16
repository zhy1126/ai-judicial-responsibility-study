const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8766';
const recordsKey='judicial_ai_responsibility_prototype_records_v1';
const roles=['lawyer','litigant','public'],conditions=process.env.STUDY_SMOKE?['none']:['none','procedural','substantive','decisional'];
async function orient(p){
 await p.locator('#role-dialog[open]').waitFor();assert.equal(await p.locator('#role-continue').isDisabled(),true);
 await p.locator('#role-video').evaluate(v=>v.playbackRate=16);await p.locator('#role-video-play').click();
 await p.waitForFunction(()=>state.orientation[state.caseType].videoCompleted);
 await p.clock.runFor(5500);await p.locator('#role-continue').click();
}
async function read(p){
 for(const tab of ['overview','evidence','task']){
  await p.locator(`[data-tab=${tab}]`).click();
  await p.locator('#dossier-content').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});
  assert.equal(await p.locator('#dossier-confirm').isDisabled(),true);
  await p.clock.runFor(5500);await p.locator('#dossier-confirm').check();
 }
 await p.locator('#to-replay').click();
}
async function finish(p,audio=false){
 if(audio){await p.locator('#playback-toggle').click();await p.waitForFunction(()=>state.audio.completed);}
 else {assert.equal(await p.locator('#transcript-confirm').isDisabled(),true);await p.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await p.clock.runFor(31000);}
 await p.locator('#transcript-confirm').check();await p.locator('#to-decision').click();await p.locator('#to-survey').click();
 assert.equal(await p.locator('.ranking-item').count(),4);
 await p.locator('[name=manipulationCheck]').selectOption('none');await p.locator('[name=finalSigner]').selectOption('judge');
 await p.locator('#ranking-confirm').check();
 for(const n of ['fairness','control','clarity','judgeOwnership','aiTrust','legitimacy','acceptance','unease'])await p.locator(`[name=${n}][value="4"]`).check();
 await p.locator('[name=involvement][value="4"]').check();await p.locator('[name=honestConfirm]').check();await p.locator('#submit-evaluation').click();
}
function wav(){const size=32000,b=Buffer.alloc(44+size);b.write('RIFF');b.writeUInt32LE(36+size,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(size,40);return b;}
(async()=>{const browser=await chromium.launch({headless:true});try{
 const texts={};let count=0;
 for(const role of roles)for(const condition of conditions)for(const firstCase of ['natural','statutory']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install();await p.goto(`${base}/?view=participant&preview=1&role=${role}&condition=${condition}&case=${firstCase}`);
  await p.locator('#consent-checkbox').check();await p.locator('#start-study').click();
  if(count===0)await p.screenshot({path:'../../work/role-mobile.png',fullPage:true,animations:'disabled'});
  await orient(p);const assignment=await p.evaluate(()=>state.assignment);
  for(let i=0;i<2;i++){
   const caseType=await p.evaluate(()=>state.caseType);await read(p);
   const text=await p.locator('#narration-text').innerText();if(texts[caseType])assert.equal(text,texts[caseType]);else texts[caseType]=text;
   assert.match(await p.locator('#condition-disclosure').innerText(),/^AI 参与程度：/);
   assert.equal(await p.locator('#chat-messages').count(),0);
   if(count===0&&i===0){await p.screenshot({path:'../../work/narration-mobile.png',fullPage:true,animations:'disabled'});await p.reload();await p.locator('#screen-replay.active').waitFor();}
   await finish(p);await p.locator(i===0?'#screen-between.active':'#screen-debrief.active').waitFor();
   if(i===0){await p.reload();await p.locator('#next-case').click();await orient(p);assert.deepEqual(await p.evaluate(()=>state.assignment),assignment);}
  }
  const record=await p.evaluate(k=>JSON.parse(localStorage.getItem(k))[0],recordsKey);
  assert.equal(record.responses.length,2);assert.equal(record.completed,true);assert.equal(record.retained,true);
  for(const r of record.responses){assert.equal(r.orientation.videoCompleted,true);assert.equal(r.rankingIds.length,4);assert.equal(r.involvement,4);assert.ok(r.orientation.version.endsWith('-v2'));assert.ok(r.orientation.videoMax>=17);assert.equal(r.presentation,'shared_plain_text');assert.ok(r.consent.acceptedAt);}
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  if(count===0){p.on('dialog',d=>d.accept());await p.locator('#delete-response').click();await p.reload();assert.equal(await p.locator('#screen-debrief h1').innerText(),'本次作答已退出');assert.equal(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]').length,recordsKey),0);}
  await context.close();console.log('Passed',++count,role,condition,firstCase);
 }
 // Both case recordings enable one shared audio+text interface.
 const c=await browser.newContext(),p=await c.newPage();await p.clock.install();
 await p.route('**/audio-config.js*',r=>r.fulfill({contentType:'application/javascript',body:"window.STUDY_AUDIO_VERSION=StudyNarration.VERSION;window.STUDY_AUDIO={natural:'./test-natural.wav',statutory:'./test-statutory.wav'};"}));
 await p.route('**/test-*.wav',r=>r.fulfill({contentType:'audio/wav',body:wav()}));
 await p.goto(`${base}/?view=participant&preview=1&role=public&condition=none&case=natural`);await p.locator('#consent-checkbox').check();await p.locator('#start-study').click();await orient(p);
 for(let i=0;i<2;i++){await read(p);assert.equal(await p.locator('#audio-panel').isVisible(),true);assert.equal(await p.locator('#narration-text p').count(),5);await finish(p,true);if(i===0){await p.locator('#next-case').click();await orient(p);}}
 const record=await p.evaluate(k=>JSON.parse(localStorage.getItem(k))[0],recordsKey);assert.ok(record.responses.every(r=>r.presentation==='shared_audio_and_text'&&r.audio.completed));await c.close();
 console.log(`Passed: ${count} two-case paths (${count*2} responses), actual role video playback, timed reading, shared text equality, refresh, consent, mandatory ranking, withdrawal, mobile width and both-case audio.`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
