const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8765';
const draftKey='judicial_ai_responsibility_draft_v2';
async function confirmSection(page,tab){
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.locator('#dossier-content').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});
  await page.locator('#dossier-confirm').check();
}
async function startPreview(page,caseType='natural'){
  await page.goto(`${base}/?view=participant&preview=1&role=lawyer&condition=none&case=${caseType}`);
  await page.locator('#consent-checkbox').check();await page.locator('#start-study').click();
}
async function readAll(page){for(const tab of ['overview','evidence','task'])await confirmSection(page,tab);await page.locator('#to-replay').click();}
// A local test fixture, never shipped as study audio.
function wav(seconds=4){
  const bytes=8000*seconds*2,b=Buffer.alloc(44+bytes);b.write('RIFF');b.writeUInt32LE(36+bytes,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(bytes,40);return b;
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  await page.clock.install();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?view=participant');
  assert.equal(await page.getByText('您是否已取得法学专业的相关学位？',{exact:true}).count(),1);
  await page.locator('[name=practicingLawyer][value=no]').check();await page.locator('[name=litigationExperience][value=yes]').check();
  await page.locator('[name=practicingLawyer][value=yes]').check();
  assert.equal(await page.locator('#litigation-question').isVisible(),false);
  assert.equal(await page.locator('[name=litigationExperience]:checked').count(),0);
  assert.equal(await page.locator('[name=litigationExperience][value=yes]').isDisabled(),true);
  await page.locator('[name=licenseActive][value=yes]').check();await page.locator('[name=legalDegree][value=yes]').check();
  await page.locator('[name=practicingLawyer][value=no]').check();
  assert.equal(await page.locator('[name=licenseActive]:checked').count(),0);
  await page.locator('#consent-checkbox').check();await page.locator('#start-study').click();
  assert.ok((await page.locator('#intro-error').innerText()).includes('请完成'));
  await page.locator('[name=practicingLawyer][value=yes]').check();await page.locator('[name=licenseActive][value=yes]').check();await page.locator('#start-study').click();
  const assignment=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).assignment,draftKey);
  assert.equal(assignment.role,'lawyer');assert.equal(assignment.background.litigationExperience,null);assert.equal(assignment.background.legalDegree,'yes');
  assert.equal(await page.locator('#dossier-confirm').isDisabled(),true,'long mobile overview requires scrolling');
  for(const tab of ['evidence','task','overview'])await page.locator(`[data-tab=${tab}]`).click();
  assert.equal(await page.locator('#to-replay').isDisabled(),true,'visits alone do not qualify');
  await confirmSection(page,'overview');await confirmSection(page,'evidence');
  assert.equal(await page.locator('#to-replay').isDisabled(),true,'two sections do not qualify');
  await page.reload();assert.equal(await page.locator('#reading-progress').innerText(),'已完成 2 / 3 栏');
  assert.equal(await page.locator('#to-replay').isDisabled(),true);
  await confirmSection(page,'task');assert.equal(await page.locator('#to-replay').isDisabled(),false);
  await page.locator('#dossier-confirm').uncheck();assert.equal(await page.locator('#to-replay').isDisabled(),true);
  await page.locator('#dossier-confirm').check();await page.locator('#to-replay').click();
  await page.locator('#playback-toggle').click();await page.clock.runFor(1500);
  assert.ok((await page.locator('#stream-text').innerText()).length>0);
  await page.locator('#playback-toggle').click();const text=await page.locator('#stream-text').innerText();await page.clock.runFor(90000);
  assert.equal(await page.locator('#stream-text').innerText(),text);assert.equal(await page.locator('#to-decision').isDisabled(),true);
  await page.reload();assert.equal(await page.locator('#stream-text').innerText(),text);
  await page.locator('#playback-toggle').click();await page.clock.runFor(90000);await page.locator('#transcript-confirm').check();
  assert.equal(await page.locator('#to-decision').isDisabled(),false);assert.equal(await page.locator('#stream-text').innerText(),'');
  await page.locator('#playback-restart').click();assert.equal(await page.locator('#to-decision').isDisabled(),true);
  await page.clock.runFor(1200);await page.locator('#playback-toggle').click();
  await page.screenshot({path:'../../work/revision-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);await context.close();

  const oldContext=await browser.newContext(),oldPage=await oldContext.newPage();await oldPage.goto(base+'/?view=participant');
  const oldAssignment=await oldPage.evaluate(k=>{
   const assignment=StudyCore.assignParticipant({practicingLawyer:'no',legalDegree:'yes',litigationExperience:'yes'},{choose:x=>x[0],sessionId:'V2-KEEP'});
   assignment.version='2.0.0';assignment.background.legalEducation='yes';delete assignment.background.legalDegree;
   localStorage.setItem(k,JSON.stringify({version:'2.0.0',epoch:'',assignment,step:'survey',ranking:['judge','court'],rankingInitial:['judge','court'],readTabs:['overview','evidence','task'],dossierConfirmed:true,transcriptConfirmed:true}));return assignment;
  },draftKey);
  await oldPage.reload();await oldPage.locator('#screen-dossier.active').waitFor();
  assert.equal(await oldPage.locator('#reading-progress').innerText(),'已完成 0 / 3 栏');
  assert.deepEqual(await oldPage.evaluate(()=>state.assignment),oldAssignment);
  assert.equal(await oldPage.evaluate(()=>state.assignment.background.legalDegree),undefined,'old education is never converted to a degree');
  await oldContext.close();

  for(const caseType of ['natural','statutory']){
   const audioContext=await browser.newContext(),audioPage=await audioContext.newPage();let fail=caseType==='statutory';
   await audioPage.route('**/audio-config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.STUDY_AUDIO='+JSON.stringify(Object.fromEntries(['natural','statutory'].map(k=>[k,Object.fromEntries(['none','procedural','substantive','decisional'].map(c=>[c,`./audio/recordings/${k}-${c}.wav`]))])))+';'}));
   await audioPage.route('**/audio/recordings/*.wav',route=>{
    if(fail)return route.fulfill({status:404,body:'missing'});
    const body=wav(),range=route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    if(!range)return route.fulfill({contentType:'audio/wav',headers:{'Accept-Ranges':'bytes'},body});
    const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),body.length-1):body.length-1;
    return route.fulfill({status:206,contentType:'audio/wav',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${body.length}`},body:body.subarray(start,end+1)});
   });
   await startPreview(audioPage,caseType);await readAll(audioPage);
   assert.equal(await audioPage.locator('#stream-panel').isVisible(),false);assert.equal(await audioPage.locator('#stream-text').innerText(),'');
   assert.equal(await audioPage.locator('#judgment-audio').getAttribute('controls'),null,'audio exposes no skip control');
   assert.equal(await audioPage.locator('#transcript-confirm').isDisabled(),true);
   if(fail){await audioPage.locator('#playback-toggle').click();await audioPage.getByText('录音暂时无法播放，请重试。完整收听后才能继续。',{exact:true}).waitFor();assert.equal(await audioPage.locator('#to-decision').isDisabled(),true);fail=false;}
   await audioPage.locator('#playback-toggle').click();
   await audioPage.waitForFunction(()=>document.querySelector('#judgment-audio').currentTime>0.8);
   await audioPage.locator('#playback-toggle').click();
   const position=await audioPage.locator('#judgment-audio').evaluate(a=>a.currentTime);
   await audioPage.reload();await audioPage.waitForFunction(()=>document.querySelector('#judgment-audio').readyState>=1&&pendingAudioPosition===null);
   assert.ok((await audioPage.locator('#judgment-audio').evaluate(a=>a.currentTime))>=position-0.2,'audio resumes its saved position');
   assert.equal(await audioPage.locator('#judgment-audio').evaluate(a=>a.paused),true,'refresh does not autoplay');
   await audioPage.locator('#playback-toggle').click();await audioPage.locator('#transcript-confirm:not([disabled])').waitFor();
   await audioPage.locator('#transcript-confirm').check();await audioPage.locator('#to-decision').click();await audioPage.locator('#screen-decision.active').waitFor();
   assert.equal(await audioPage.locator('#stream-text').innerText(),'');
   await audioContext.close();
  }
  console.log('Passed: mutual exclusion, degree semantics, scroll/three-confirm gate, reload, pause/restart, v2 migration, audio-only playback, real media resume/completion and missing-audio retry.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
