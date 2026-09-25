const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8775';
(async()=>{const b=await chromium.launch({headless:true});try{
 const c=await b.newContext({viewport:{width:390,height:844}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();
 await p.goto(base+'/?view=participant&preview=1&role=judge&condition=none&case=natural');await p.locator('#consent-checkbox').check();await p.locator('[name=backgroundChoice][value=judge]').check();await p.locator('#start-study').click();
 for(let trial=0;trial<2;trial++){
  await p.locator('#role-dialog[open]').waitFor();await p.evaluate(()=>{document.querySelector('#role-dialog').close();state.orientation[state.caseType]={version:STUDY_ROLE_MEDIA.version,completed:true,videoCompleted:true,visibleMs:18000};state.reading=Object.fromEntries(StudyCore.DOSSIER_TABS.map(k=>[k,{confirmed:true,reachedEnd:true,visibleMs:8000}]));setStep('replay');});
  await p.clock.runFor(15250);await p.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await p.locator('#transcript-confirm').check();await p.locator('#to-decision').click();await p.locator('#to-survey').click();
  assert.equal(await p.locator('[data-rating] [data-unsure]').count(),0);assert.equal(await p.locator('[data-rating].has-rating').count(),0);for(const field of await p.locator('[data-rating] input[type=hidden]').all())assert.equal(await field.inputValue(),'');
  for(const id of ['judge','court','provider','system'])await p.locator('#responsibility-score-'+id).fill('50');await p.locator('#to-allocation').click();for(const id of ['judge','court','provider','system'])await p.locator('#responsibility-allocation-'+id).fill('25');
  await p.locator('[name=manipulationCheck]').selectOption('none');await p.locator('[name=finalSigner]').selectOption('judge');await p.locator('[name=honestConfirm]').check();
  await p.locator('#submit-evaluation').click();assert.match(await p.locator('#survey-error').textContent(),/1–7/);assert.equal(await p.evaluate(()=>state.response),null);
  if(trial===0){
   // Reproduce an old unfinished draft with 'unsure', retaining a valid answer next to it.
   await p.locator('[data-rating=control] [data-score="6"]').click();await p.evaluate(()=>{document.querySelector('[name=fairness]').value='unsure';captureForm();saveDraft();});
   await p.reload();await p.locator('#screen-survey.active').waitFor();assert.equal(await p.locator('[name=fairness]').inputValue(),'');assert.equal(await p.locator('[name=control]').inputValue(),'6');assert.doesNotMatch(await p.locator('#feedback-fairness').textContent(),/无法判断/);
  }
  for(const field of await p.locator('[data-rating]').all())await field.locator('[data-score="4"]').click();
  // UI removal alone is insufficient: the submission validator must reject the old value too.
  await p.evaluate(()=>document.querySelector('[name=fairness]').value='unsure');await p.locator('#submit-evaluation').click();assert.match(await p.locator('#survey-error').textContent(),/1–7/);assert.equal(await p.evaluate(()=>state.response),null);
  await p.locator('[data-rating=fairness] [data-score="4"]').click();
  if(trial===0)await p.locator('#rating-list').screenshot({path:'../audio-0923/required-ratings-mobile.png'});
  await p.locator('#submit-evaluation').click();
  if(trial===0){await p.locator('#screen-between.active').waitFor();await p.locator('#next-case').click();}else await p.locator('#screen-debrief.active').waitFor();
 }
 const answers=await p.evaluate(()=>state.session.responses);assert.equal(answers.length,2);for(const a of answers){assert.equal(a.ratingPresentation,'required-seven-point-slider-2026-09-25-v1');for(const v of Object.values(a.ratings))assert.equal(v,4);for(const v of Object.values(a.ratingStatus))assert.equal(v,'answered');assert.equal(a.perceivedHarm,4);assert.equal(a.involvement,4);}
 // Historical submissions are not parsed as new answers or rewritten by draft restoration.
 const before=await p.evaluate(()=>{const records=JSON.parse(localStorage.getItem(STORAGE_KEY));records[0].responses[0].ratings.fairness=null;records[0].responses[0].ratingStatus.fairness='unsure';records[0].responses[0].ratingPresentation='seven-point-slider-2026-09-17';localStorage.setItem(STORAGE_KEY,JSON.stringify(records));return localStorage.getItem(STORAGE_KEY);});await p.reload();assert.equal(await p.evaluate(()=>localStorage.getItem(STORAGE_KEY)),before);
 assert.deepEqual(errors,[]);await c.close();console.log('Passed mobile required ratings: no default/unsure, rejects blank and legacy value, preserves draft scores, both cases submit numeric ratings, saved historical answers unchanged.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
