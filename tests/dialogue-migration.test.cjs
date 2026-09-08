const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8765';
const key='judicial_ai_responsibility_draft_v2',recordsKey='judicial_ai_responsibility_prototype_records_v1';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const version of ['2.0.0','2.1.0'])for(const completed of [false,true]){
   const context=await browser.newContext(),page=await context.newPage();await page.goto(base+'/?view=participant');
   const seeded=await page.evaluate(({key,recordsKey,completed,version})=>{
    const assignment=StudyCore.assignParticipant({practicingLawyer:'no',legalDegree:'yes',litigationExperience:'no'},{choose:x=>x[0],sessionId:'MIGRATION-KEEP'});
    const response=completed?{version:'2.1.0',sessionId:assignment.sessionId,role:assignment.role,condition:assignment.condition,caseType:assignment.caseType,openResponse:'旧材料的已提交回答',ratings:{fairness:7},submittedAt:'2026-09-08T00:00:00Z'}:null;
    localStorage.setItem(recordsKey,JSON.stringify(response?[response]:[]));
    localStorage.setItem(key,JSON.stringify({version,epoch:'',assignment,step:completed?'debrief':'survey',ranking:['court','judge'],rankingInitial:['judge','court'],reading:Object.fromEntries(['overview','evidence','task'].map(k=>[k,{reachedEnd:true,confirmed:true}])),formValues:{openResponse:'旧材料的未提交评价',fairness:'7'},transcriptConfirmed:true,replayExposureMs:88888,speechMetadata:{inputMethod:'speech',attempts:2},replay:version==='2.1.0'?{mode:'stream',completed:true,stream:{elapsedMs:120000,completed:true}}:undefined,response}));return {assignment,response};
   },{key,recordsKey,completed,version});
   await page.reload();
   assert.deepEqual(await page.evaluate(()=>state.assignment),seeded.assignment);
   assert.equal(await page.locator('#reading-progress').innerText(),version==='2.1.0'?'已完成 3 / 3 栏':'已完成 0 / 3 栏');
   const draft=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
   if(!completed){
    assert.equal(await page.locator(version==='2.1.0'?'#screen-replay.active':'#screen-dossier.active').count(),1);assert.equal(await page.locator('#transcript-confirm').isDisabled(),true);
    assert.equal(draft.replay.version,'dialogue-2026-09-08-v1');assert.equal(draft.replay.completed,false);assert.equal(draft.replay.stream.elapsedMs,0);
    assert.deepEqual(draft.formValues,{});assert.deepEqual(draft.ranking,['judge','court']);assert.ok(draft.replayExposureMs<1000);
    assert.equal(await page.locator('#open-response').inputValue(),'');assert.equal(await page.locator('#dialogue-update-note').evaluate(el=>el.classList.contains('hidden')),false);assert.equal(draft.speechMetadata.attempts,0);
   }else{
    assert.equal(await page.locator('#screen-debrief.active').count(),1);
    assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),recordsKey),[seeded.response]);
    await page.locator('#delete-response').click();assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),recordsKey),[]);
    assert.ok(!(await page.evaluate(k=>localStorage.getItem(k),key)).includes('旧材料'));
   }
   await context.close();
  }
  const context=await browser.newContext(),page=await context.newPage();
  await page.route('**/audio-config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.STUDY_AUDIO_VERSION="old-monologue";window.STUDY_AUDIO='+JSON.stringify(Object.fromEntries(['natural','statutory'].map(k=>[k,Object.fromEntries(['none','procedural','substantive','decisional'].map(c=>[c,'./old.mp3']))])))+';'}));
  await page.goto(base+'/?view=participant&preview=1&role=lawyer&condition=procedural&case=natural');await page.locator('#consent-checkbox').check();await page.locator('#start-study').click();
  assert.equal(await page.evaluate(()=>state.replay.mode),'stream','old audio must not play over new dialogue');
  assert.equal(await page.locator('#judgment-audio').getAttribute('src'),null);
  await context.close();console.log('Passed: old monologue migration resets replay and pending ratings, preserves assignment/reading/submitted records, deletion protection and audio-version gating.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
