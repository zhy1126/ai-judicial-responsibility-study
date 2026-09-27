const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8775';
(async()=>{const b=await chromium.launch({headless:true});try{
 for(const condition of ['none','procedural','substantive','decisional'])for(const caseType of ['natural','statutory']){
  const c=await b.newContext({viewport:{width:390,height:844}}),p=await c.newPage();await p.clock.install();
  // The short reading gate must still work if the scenario video fails to load.
  if(caseType==='statutory')await p.route('**/video/*.mp4',r=>r.abort());
  await p.goto(`${base}/?view=participant&preview=1&role=public&case=${caseType}&condition=${condition}`);
  await p.locator('#consent-checkbox').check();await p.locator('[name=backgroundChoice][value=other]').check();await p.locator('#start-study').click();await p.locator('#role-dialog[open]').waitFor();
  await p.locator('#role-video').evaluate(v=>v.pause());
  await p.clock.runFor(2750);assert.equal(await p.locator('#role-continue').isDisabled(),true);
  await p.clock.runFor(500);assert.equal(await p.locator('#role-continue').isEnabled(),true,'video completion cannot lock the three-second gate');
  assert.equal(await p.evaluate(()=>Boolean(state.orientation[state.caseType].videoCompleted)),false);
  assert.doesNotMatch(await p.locator('#role-status').textContent(),/先观看|18/);await p.locator('#role-continue').click();
  for(const tab of ['overview','evidence','task']){
   assert.equal(await p.evaluate(()=>state.activeDossierTab),tab);
   await p.locator('#dossier-content').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});
   await p.clock.runFor(8250);await p.locator('#dossier-confirm').click();
  }
  await p.locator('#screen-replay.active').waitFor();
  await p.clock.runFor(15250);await p.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});
  assert.equal(await p.locator('#narration-text .narration-stage-note').count(),3);
  assert.deepEqual(await p.locator('#narration-text p').allTextContents(),await p.evaluate(()=>StudyNarration.paragraphsFor(state.caseType,state.condition)));
  assert.deepEqual(await p.locator('.narration-stage-note').evaluateAll(es=>es.map(e=>e.dataset.stage)),['materials','analysis','result']);
  for(const note of await p.locator('.narration-stage-note').all())assert.equal(await note.evaluate(e=>getComputedStyle(e).color),'rgb(156, 33, 43)');
  assert.equal(await p.locator('#transcript-confirm').isEnabled(),true);assert.equal(await p.locator('#narration-text').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await p.locator('#transcript-confirm').check();await p.locator('#to-decision').click();await p.locator('#screen-decision.active').waitFor();
  await c.close();
 }
 console.log('PASS: eight case/condition combinations; 3s reading works with paused/failed video; stages are explicit and audio words unchanged; mobile and no-audio continuation.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
