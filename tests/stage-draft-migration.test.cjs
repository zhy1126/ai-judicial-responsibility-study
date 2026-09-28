const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8775';
(async()=>{const b=await chromium.launch({headless:true});try{
 const p=await b.newPage();await p.clock.install();await p.goto(base+'/?view=participant&preview=1&role=public&case=natural&condition=procedural');
 await p.locator('#consent-checkbox').check();await p.locator('[name=backgroundChoice][value=other]').check();await p.locator('#start-study').click();await p.locator('#role-dialog[open]').waitFor();
 const assignment=await p.evaluate(()=>{
  document.querySelector('#role-dialog').close();state.orientation[state.caseType]={version:STUDY_ROLE_MEDIA.version,completed:true,videoCompleted:true,visibleMs:18000,videoMax:18};
  state.reading=Object.fromEntries(StudyCore.DOSSIER_TABS.map(k=>[k,{confirmed:true,reachedEnd:true,visibleMs:8000}]));
  state.replay.textVisibleMs=16000;state.replay.textReachedEnd=true;renderNarrationProgress();updatePlaybackGate();document.querySelector('#transcript-confirm').checked=true;
  delete state.replay.participationVersion;setStep('survey');document.querySelector('[name=fairness]').value='6';captureForm();saveDraft();return state.assignment;
 });
 await p.reload();assert.equal(await p.evaluate(()=>state.step),'replay','old survey drafts must read the new stage notes before being labelled as exposed');assert.deepEqual(await p.evaluate(()=>state.assignment),assignment);
 assert.equal(await p.locator('#transcript-confirm').isDisabled(),true);assert.equal(await p.locator('[name=fairness]').inputValue(),'');
 await p.clock.runFor(15250);await p.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await p.locator('#transcript-confirm').check();await p.locator('#to-decision').click();await p.locator('#to-survey').click();
 for(const id of ['judge','court','provider','system'])await p.locator('#responsibility-score-'+id).fill('50');for(const id of ['judge','court','provider','system'])await p.locator('#responsibility-allocation-'+id).fill('25');
 for(const field of await p.locator('[data-rating]').all())await field.locator('[data-score="4"]').click();await p.locator('[name=manipulationCheck]').selectOption('procedural');await p.locator('[name=finalSigner]').selectOption('judge');await p.locator('[name=honestConfirm]').check();await p.locator('#submit-evaluation').click();await p.locator('#screen-between.active').waitFor();
 const saved=await p.evaluate(()=>state.response);assert.equal(saved.participationPresentation,'stage-disclosure-2026-09-27-v1');assert.equal(saved.orientation.minimumReadingMs,null,'old completed orientation must not acquire an invented new threshold');
 const raw=await p.evaluate(()=>localStorage.getItem(STORAGE_KEY));await p.reload();assert.equal(await p.evaluate(()=>localStorage.getItem(STORAGE_KEY)),raw,'submitted records remain unchanged');
 console.log('PASS: old survey draft rereads stage notes before version labelling, keeps grouping, records unknown old role threshold honestly, and preserves submitted data.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
