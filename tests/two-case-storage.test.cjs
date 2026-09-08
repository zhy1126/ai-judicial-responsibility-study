const assert=require('node:assert/strict');const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8765',draftKey='judicial_ai_responsibility_draft_v2',recordsKey='judicial_ai_responsibility_prototype_records_v1';
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext(),firstTab=await context.newPage();await firstTab.goto(base+'/?view=participant');
 const seeded=await firstTab.evaluate(({draftKey,recordsKey})=>{
  const assignment=StudyCore.assignParticipant({practicingLawyer:'yes',licenseActive:'yes',legalDegree:'yes'},{choose:x=>x[0],sessionId:'TABS'}),response={...assignment,caseType:assignment.caseType,openResponse:'原始首案回答',submittedAt:'2026-09-08T00:00:00Z'};
  const session=StudySession.submit(StudySession.create(assignment),response,assignment),draft={version:'2.1.0',epoch:localStorage.getItem('judicial_ai_responsibility_reset_epoch_v2')||'',assignment,session,step:'between',ranking:['judge','court'],rankingInitial:['judge','court'],response};localStorage.setItem(draftKey,JSON.stringify(draft));localStorage.setItem(recordsKey,JSON.stringify([StudySession.record(session,assignment)]));return {assignment,response,draft};
 },{draftKey,recordsKey});await firstTab.reload();await firstTab.locator('#screen-between.active').waitFor();
 const secondTab=await context.newPage();await secondTab.goto(base+'/?view=participant');await secondTab.locator('#next-case').click();
 await secondTab.evaluate(()=>{document.querySelector('#open-response').value='第二案未提交文字';captureForm();saveDraft();});
 const newer=await secondTab.evaluate(k=>JSON.parse(localStorage.getItem(k)),draftKey);
 await firstTab.evaluate(()=>saveDraft());
 assert.deepEqual(await firstTab.evaluate(k=>JSON.parse(localStorage.getItem(k)),draftKey),newer,'stale first-case autosave must not erase the second-case draft');
 await firstTab.locator('#next-case').click();assert.deepEqual(await firstTab.evaluate(k=>JSON.parse(localStorage.getItem(k)),draftKey),newer,'stale transition must not restart the second case');
 await firstTab.close();await secondTab.reload();assert.equal(await secondTab.locator('#open-response').inputValue(),'第二案未提交文字');await context.close();
 const legacyContext=await browser.newContext(),page=await legacyContext.newPage();await page.goto(base+'/?view=participant');
 await page.evaluate(({draftKey,recordsKey,seeded})=>{localStorage.setItem(recordsKey,JSON.stringify([seeded.response]));const draft={...seeded.draft,epoch:localStorage.getItem('judicial_ai_responsibility_reset_epoch_v2')||'',session:undefined,response:null,step:'survey',formValues:{openResponse:'过时未提交内容'}};localStorage.setItem(draftKey,JSON.stringify(draft));},{draftKey,recordsKey,seeded});
 await page.reload();await page.locator('#screen-between.active').waitFor();assert.deepEqual(await page.evaluate(()=>state.session.responses),[seeded.response]);assert.equal(await page.evaluate(()=>state.session.migratedFrom),'single_case');
 assert.equal(await page.evaluate(()=>{try{updateSavedResponse(SESSION.record({...state.session,responses:[{...state.response,openResponse:'覆盖'}]},state.assignment));return false;}catch{return true;}}),true,'legacy saved answer cannot be overwritten');
 assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),recordsKey),[seeded.response]);
 const storedRetained={...seeded.response,retained:true};
 await page.evaluate(({draftKey,recordsKey,storedRetained})=>{const draft=JSON.parse(localStorage.getItem(draftKey));draft.session=StudySession.advance(draft.session);draft.session.responses[0]={...draft.session.responses[0],retained:null};draft.response=null;draft.step='dossier';draft.formValues={openResponse:'第二案应继续保存'};localStorage.setItem(draftKey,JSON.stringify(draft));localStorage.setItem(recordsKey,JSON.stringify([storedRetained]));},{draftKey,recordsKey,storedRetained});
 await page.reload();await page.locator('#screen-dossier.active').waitFor();assert.equal(await page.evaluate(()=>state.session.caseIndex),1);assert.deepEqual(await page.evaluate(()=>state.session.responses[0]),storedRetained,'stored legacy retention wins without restarting second-case progress');assert.equal(await page.locator('#open-response').inputValue(),'第二案应继续保存');
 await page.evaluate(()=>updateSavedResponse(SESSION.record(SESSION.submit(state.session,{...state.session.responses[0],caseType:state.caseType,openResponse:'第二案'},state.assignment),state.assignment)));assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k))[0].responses.length,recordsKey),2);
 await legacyContext.close();
 console.log('Passed: stale first-case autosave and transition preserve second-case drafts; interrupted legacy submission recovers the original answer and rejects replacement.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
