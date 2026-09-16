const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8766';
(async()=>{const b=await chromium.launch({headless:true});try{
 for(const kind of ['lawyer','judge','lay-first','lay-last']){
  const c=await b.newContext({viewport:{width:390,height:844}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/?view=participant');
  await p.locator('#consent-checkbox').check();await p.locator('[name=practicingLawyer][value=no]').check();assert.equal(await p.locator('#judge-question').isVisible(),true);
  await p.locator('[name=judgeCaseExperience][value=no]').check();await p.locator('[name=litigationExperience][value=yes]').check();
  if(kind==='lawyer'){await p.locator('[name=practicingLawyer][value=yes]').check();assert.equal(await p.locator('#judge-question').isVisible(),false);assert.equal(await p.locator('[name=litigationExperience][value=yes]').isChecked(),false);}
  if(kind==='judge'){await p.locator('[name=judgeCaseExperience][value=yes]').check();assert.equal(await p.locator('#litigation-question').isVisible(),false);}
  await p.locator('[name=legalDegree][value=no]').check();
  if(kind.startsWith('lay'))await p.evaluate(last=>{crypto.getRandomValues=a=>{a.fill(last?1:0);return a;};},kind==='lay-last');
  await p.locator('#start-study').click();await p.locator('#role-dialog[open]').waitFor();
  const expected=kind==='lay-first'?'litigant':kind==='lay-last'?'public':kind;
  assert.equal(await p.evaluate(()=>state.role),expected);assert.equal(await p.evaluate(()=>state.assignment.backgroundGroup),kind.startsWith('lay')?'public':kind);
  assert.match(await p.locator('#role-video').getAttribute('src'),new RegExp('-'+expected+'-v5.mp4'));
  const a=await p.evaluate(()=>state.assignment);await p.reload();assert.deepEqual(await p.evaluate(()=>state.assignment),a);
  if(kind==='judge'){
   await p.evaluate(()=>{document.querySelector('#role-dialog').close();state.orientation[state.caseType].completed=true;state.reading=Object.fromEntries(StudyCore.DOSSIER_TABS.map(k=>[k,{confirmed:true,reachedEnd:true,visibleMs:6000}]));setStep('replay');});
   for(const condition of ['none','procedural','substantive','decisional']){
    await p.evaluate(c=>{state.condition=c;renderTranscript();},condition);
    assert.equal(await p.locator('.narration-record #condition-disclosure').textContent(),await p.evaluate(c=>StudyNarration.conditionLine(c),condition));
    const y=(await p.locator('#condition-disclosure').boundingBox()).y;await p.locator('#narration-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});assert.ok(Math.abs((await p.locator('#condition-disclosure').boundingBox()).y-y)<2);
   }
   await p.locator('.narration-record').screenshot({path:'../../work/judge-disclosure-mobile.png'});
  }
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await c.close();console.log('Screening passed:',kind);
 }
 // Old unsubmitted lay participant gets the missing judge question; condition/order/ID survive.
 const c=await b.newContext(),p=await c.newPage();await p.goto(base+'/?view=participant');
 const old=await p.evaluate(()=>{const a=StudyCore.assignParticipant({practicingLawyer:'no',judgeCaseExperience:'no',legalDegree:'yes',litigationExperience:'no'},{sessionId:'MIGRATE',choose:x=>x[0]});delete a.screeningVersion;delete a.background.judgeCaseExperience;localStorage.setItem(DRAFT_KEY,JSON.stringify({epoch:storageEpoch,version:StudyCore.VERSION,assignment:a,session:StudySession.create(a),step:'dossier'}));return a;});
 await p.reload();await p.locator('#screen-intro.active').waitFor();assert.match(await p.locator('#intro-error').textContent(),/法官办案经历/);
 await p.locator('#consent-checkbox').check();await p.locator('[name=judgeCaseExperience][value=yes]').check();await p.locator('#start-study').click();await p.locator('#role-dialog[open]').waitFor();
 const upgraded=await p.evaluate(()=>state.assignment);assert.equal(upgraded.role,'judge');for(const k of ['sessionId','condition','caseType'])assert.equal(upgraded[k],old[k]);
 // Once a case has been submitted, its old assignment and answer are retained.
 const saved=await p.evaluate(()=>{const a={...state.assignment};delete a.screeningVersion;const response={...a,caseType:a.caseType,openResponse:'已提交的原回答',submittedAt:new Date().toISOString()};const session=StudySession.create(a);session.responses=[response];localStorage.setItem(DRAFT_KEY,JSON.stringify({...snapshot(),assignment:a,session,response,step:'between'}));return response;});
 await p.reload();await p.locator('#screen-between.active').waitFor();assert.deepEqual(await p.evaluate(()=>state.session.responses[0]),saved);await c.close();
 console.log('Passed old-draft rescreening, preserved condition/order/ID and unchanged submitted case.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
