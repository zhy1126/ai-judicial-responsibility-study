const {fillBackground}=require('./browser-helpers.cjs');
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const expected=require('./fixtures/narration-0916.json'),base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8766';
(async()=>{const b=await chromium.launch({headless:true});try{
 for(const caseType of ['natural','statutory']){
 const c=await b.newContext({viewport:{width:390,height:844}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();
 await p.goto(`${base}/?view=participant&preview=1&role=public&condition=substantive&case=${caseType}`);await fillBackground(p);await p.locator('#consent-checkbox').check();await p.locator('#start-study').click();
 const before=await p.evaluate(()=>{
  document.querySelector('#role-dialog').close();state.orientation[state.caseType]={version:STUDY_ROLE_MEDIA.version,completed:true,videoCompleted:true,videoMax:18,visibleMs:18000};
  state.reading=Object.fromEntries(StudyCore.DOSSIER_TABS.map(k=>[k,{confirmed:true,reachedEnd:true,visibleMs:6000}]));
  state.replay={mode:'text',version:'shared-narration-2026-09-16-v1',completed:true,textReachedEnd:true,textVisibleMs:40000};
  document.querySelector('#transcript-confirm').checked=true;document.querySelector('[name=fairness]').value='6';document.querySelector('#responsibility-score-judge').value='95';
  state.step='survey';captureForm();saveDraft();return {assignment:state.assignment,reading:state.reading,orientation:state.orientation};
 });
 await p.reload();await p.locator('#screen-replay.active').waitFor();assert.notDeepEqual(await p.locator('#narration-text p').allTextContents(),expected[caseType]);
 assert.deepEqual(await p.evaluate(()=>state.assignment),before.assignment);assert.deepEqual(await p.evaluate(()=>state.reading),before.reading);assert.equal(await p.evaluate(()=>state.orientation[state.caseType].completed),true);assert.equal(await p.locator('[name=fairness]').inputValue(),'');assert.equal(await p.locator('#responsibility-score-judge').inputValue(),'');
 assert.match(await p.locator('#narration-reading-status').innerText(),/至少阅读 15 秒/);assert.equal(await p.locator('#transcript-confirm').isDisabled(),true);await p.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await p.clock.runFor(14000);assert.equal(await p.locator('#transcript-confirm').isDisabled(),true);await p.clock.runFor(1250);assert.deepEqual(await p.locator('#narration-text p').allTextContents(),expected[caseType]);await p.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});assert.equal(await p.locator('#transcript-confirm').isEnabled(),true);await p.locator('#transcript-confirm').check();await p.locator('#to-decision').click();await p.locator('#to-survey').click();await p.locator('#screen-survey.active').waitFor();assert.equal(await p.locator('#responsibility-score-list input').count(),4);
 // Verify every disclosure still displays the same revised case text.
 for(const condition of ['none','procedural','substantive','decisional']){await p.evaluate(condition=>{state.condition=condition;renderTranscript();},condition);assert.deepEqual(await p.locator('#narration-text p').allTextContents(),expected[caseType]);}
 assert.deepEqual(errors,[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await c.close();console.log('Passed revised text, reading gate and v1 draft migration:',caseType);
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
