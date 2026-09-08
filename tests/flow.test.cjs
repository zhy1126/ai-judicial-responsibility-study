// Optional browser regression checks; requires Playwright and a local static server.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8765';
const storageKey='judicial_ai_responsibility_prototype_records_v1', draftKey='judicial_ai_responsibility_draft_v2';
const ratings=['fairness','control','clarity','judgeOwnership','aiTrust','legitimacy','acceptance','unease'];
async function readCase(page){
 for(const tab of ['overview','evidence','task']){
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.locator('#dossier-content').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});
  await page.locator('#dossier-confirm').check();
 }
 assert.equal(await page.locator('#reading-progress').innerText(),'已完成 3 / 3 栏');
 await page.locator('#to-replay').click();
 assert.equal(await page.locator('#screen-replay').evaluate(x=>x.classList.contains('active')),true);
 assert.equal(await page.locator('.chat-message').count(),0);
 assert.equal(await page.locator('#judgment-transcript').count(),0);
 assert.equal(await page.locator('#to-decision').isDisabled(),true);
 await page.locator('#playback-toggle').click();await page.clock.runFor(120000);
 await page.locator('#transcript-confirm').check();await page.locator('#to-decision').click();
 assert.equal(await page.locator('.chat-message').count(),13,'all played messages remain in chat');
 assert.ok((await page.locator('#chat-messages').textContent()).length>400);
 await page.locator('#to-survey').click();
}
async function fillSurvey(page,condition){
 await page.locator('[name="manipulationCheck"]').selectOption(condition);await page.locator('[name="finalSigner"]').selectOption('judge');
 await page.locator('#ranking-mode').selectOption('rank');
 assert.equal(await page.locator('.ranking-item').count(),condition==='none'?2:4);
 await page.locator('[data-rank-down="0"]').click();await page.locator('#ranking-confirm').check();
 for(const name of ratings){if(condition==='none'&&['aiTrust','unease'].includes(name))continue;
  assert.equal(await page.locator(`[name="${name}"]:checked`).count(),0,'no default rating');
  assert.equal(await page.locator(`[name="${name}"]`).count(),8);
  await page.locator(`[name="${name}"][value="${name==='clarity'?'unsure':'4'}"]`).check();
 }
 await page.locator('#open-response').fill('判决形成中的复核最影响我的判断。');await page.locator('#open-response-confirm').check();
 await page.locator('[name="honestConfirm"]').check();
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
 let completed=0;
 for(const role of ['lawyer','litigant','public'])for(const condition of ['none','procedural','substantive','decisional'])for(const caseType of ['natural','statutory']){
  if(process.env.STUDY_TEST_CONDITION&&condition!==process.env.STUDY_TEST_CONDITION)continue;
  console.log(`Checking ${role}/${condition}/${caseType}`);
  const context=await browser.newContext({viewport:role==='public'?{width:390,height:844}:{width:1280,height:900}});
  const page=await context.newPage();await page.clock.install();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/?view=participant&preview=1&role=${role}&condition=${condition}&case=${caseType}`);
  assert.equal(await page.locator('input[name="practicingLawyer"]').count(),2);
  await page.locator('#consent-checkbox').check();await page.locator('#start-study').click();
  for(let caseIndex=0;caseIndex<2;caseIndex++){
  const currentCase=caseIndex===0?caseType:(caseType==='natural'?'statutory':'natural');
  assert.ok((await page.locator('#case-progress').innerText()).includes(`第 ${caseIndex+1} / 2 个案件`),JSON.stringify({role,condition,caseType,caseIndex,progress:await page.locator('#case-progress').innerText(),state:await page.evaluate(()=>({step:state.step,session:state.session,blocked:draftBlocked}))}));
  await readCase(page);
  const decision=await page.locator('#judgment-content').textContent();
  assert.ok(decision.includes(currentCase==='natural'?'十五年':'八个月'));
  assert.ok(decision.includes(currentCase==='natural'?'三年':'九万元'));
  await fillSurvey(page,condition);
  if(role==='public')assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile must not overflow');
  if(completed===0){
   await page.reload();await page.locator('#screen-survey.active').waitFor();
   assert.equal(await page.locator('#open-response').inputValue(),'判决形成中的复核最影响我的判断。');
   assert.equal(await page.locator('[name="fairness"]:checked').inputValue(),'4');
  }
  await page.locator('#survey-form button[type="submit"]').click();
  if(caseIndex===0){
   await page.locator('#screen-between.active').waitFor();assert.equal(await page.locator('#screen-debrief.active').count(),0);
   const partial=await page.evaluate(k=>JSON.parse(localStorage.getItem(k))[0],storageKey);assert.equal(partial.completed,false);assert.equal(partial.responses.length,1);
   await page.reload();await page.locator('#screen-between.active').waitFor();
   await page.locator('#next-case').click();assert.equal(await page.locator('#reading-progress').innerText(),'已完成 0 / 3 栏');assert.equal(await page.locator('#to-replay').isDisabled(),true);
   assert.equal(await page.locator('#open-response').inputValue(),'');assert.equal(await page.locator('[name="honestConfirm"]').isChecked(),false);
   assert.equal(await page.evaluate(()=>state.speechMetadata?.attempts||0),0);
   await page.reload();await page.locator('#screen-dossier.active').waitFor();
  }else await page.locator('#screen-debrief.active').waitFor();
  }

  const records=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),storageKey);
  assert.equal(records.length,1);assert.equal(records[0].completed,true);assert.equal(records[0].responses.length,2);assert.deepEqual(records[0].responses.map(r=>r.caseType),[caseType,caseType==='natural'?'statutory':'natural']);const response=records[0].responses[0];assert.equal(response.role,role);assert.equal(response.condition,condition);assert.equal(response.caseType,caseType);assert.equal(response.preview,true);
  assert.equal(response.ratings.fairness,4);assert.equal(response.ratings.clarity,null);assert.equal(response.ratingStatus.clarity,'unsure');
  if(condition==='none')assert.equal(response.ratingStatus.aiTrust,'not_applicable');
  assert.equal(new Set(response.rankingIds).size,condition==='none'?2:4);assert.equal(response.audio.status,'not_supplied');
  if(completed===0){
   const mirror=await context.newPage();await mirror.goto(page.url());
   const drafts=await page.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage)));
   await mirror.evaluate(data=>Object.entries(data).forEach(([k,v])=>sessionStorage.setItem(k,v)),drafts);await mirror.reload();
   await page.locator('#delete-response').click();
   await mirror.evaluate(()=>{saveDraft();retainResponse();});
   assert.deepEqual(await mirror.evaluate(k=>JSON.parse(localStorage.getItem(k)),storageKey),[],'stale tab cannot resurrect');
   await mirror.reload();
   assert.ok(!(await mirror.evaluate(()=>JSON.stringify(Object.entries(sessionStorage)))).includes('practicingLawyer'),'deleted background must be scrubbed');
   await mirror.close();await page.reload();await page.locator('#screen-debrief.active').waitFor();
   assert.equal(await page.locator('#retain-response').isDisabled(),true);
   assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),storageKey),[]);
   const saved=await page.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('judicial_ai_responsibility_draft_v2')));
   assert.ok(!JSON.stringify(saved).includes('复核最影响'),'deleted open answer must not survive');
   assert.ok(!JSON.stringify(saved).includes('ranking"'),'deleted ranking must not survive');
  }
  assert.deepEqual(errors,[]);await context.close();completed++;
 }
 const context=await browser.newContext();const page=await context.newPage();await page.clock.install();
 await page.addInitScript(()=>{window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;});
 await page.goto(`${base}/?view=participant`);
 const legacy={sessionId:'OLD-1',role:'public',condition:'none',caseType:'statutory',ratings:{fairness:7},ranking:['本案承办法官'],openResponse:'旧数据',submittedAt:'2026-09-01T00:00:00.000Z'};
 await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify([value])),{key:storageKey,value:legacy});
 await page.locator('#consent-checkbox').check();
 for(const name of ['practicingLawyer','legalDegree','litigationExperience'])await page.locator(`[name="${name}"][value="${name==='litigationExperience'?'yes':'no'}"]`).check();
 await page.locator('#start-study').click();
 const first=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).assignment,draftKey);
 assert.ok(['litigant','public'].includes(first.role));assert.equal(first.background.litigationExperience,'yes');
 await page.reload();const restored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).assignment,draftKey);assert.deepEqual(restored,first);
 await readCase(page);await fillSurvey(page,first.condition);
 assert.equal(await page.locator('#speech-start').isDisabled(),true,'unsupported browser still permits typed completion');
 await page.locator('#survey-form button[type="submit"]').click();await page.locator('#screen-between.active').waitFor();await page.locator('#next-case').click();await readCase(page);await fillSurvey(page,first.condition);
 await page.locator('#survey-form button[type="submit"]').click();await page.locator('#screen-debrief.active').waitFor();
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),storageKey);assert.equal(saved.length,2);assert.deepEqual(saved[0],legacy);
 const jsonPromise=page.waitForEvent('download');await page.locator('#download-response').click();const jsonDownload=await jsonPromise;assert.equal(JSON.parse(await fs.readFile(await jsonDownload.path(),'utf8')).version,'2.1.0');
 await page.goto(base+'/?view=researcher');
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-csv').click();const download=await downloadPromise;
 const csv=await fs.readFile(await download.path(),'utf8');assert.ok(csv.includes('旧数据'));assert.ok(csv.includes('判决形成中的复核最影响我的判断。'));assert.ok(csv.includes('ranking_ids'));assert.ok(csv.includes('clarity_status'));assert.ok(csv.includes('case_number'));assert.ok(csv.includes('study_completed'));assert.ok(csv.includes('two-cases-2026-09-08-v1'));assert.equal(await page.locator('#metric-complete').innerText(),'1');
 const stale=await context.newPage();await stale.goto(base+'/?view=participant&preview=1&role=public&condition=none&case=natural');
 const preview=await context.newPage();await preview.goto(stale.url());await preview.locator('#consent-checkbox').check();await preview.locator('#start-study').click();
 page.once('dialog',dialog=>dialog.accept());await page.locator('#clear-data').click();
 await stale.locator('#consent-checkbox').check();await stale.locator('#start-study').click();assert.ok((await stale.locator('#intro-error').innerText()).includes('刷新'));
 await preview.reload();assert.equal(await preview.locator('#screen-intro.active').count(),1,'cleared preview cannot resume old draft');
 assert.deepEqual(await preview.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('judicial_ai_responsibility_draft_v2'))),[]);
 await context.close();
 console.log(`Passed: ${completed} complete two-case paths (${completed*2} evaluations), mobile widths, no defaults, applicability, refresh, delete tombstone, real screening, manual fallback, legacy preservation and full CSV export.`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
