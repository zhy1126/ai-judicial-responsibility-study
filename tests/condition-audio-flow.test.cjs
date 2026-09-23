// Integration test with shipped MP3s. Uses faster playback only inside this test.
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const N=require('../study-narration.js'),base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8773';
async function setup(p,caseType,condition){
 await p.goto(`${base}/?view=participant&preview=1&role=judge&condition=${condition}&case=${caseType}`);
 await p.locator('#consent-checkbox').check();await p.locator('[name=backgroundChoice][value=judge]').check();await p.locator('#start-study').click();
 await p.locator('#role-dialog[open]').waitFor();
 await p.evaluate(()=>{document.querySelector('#role-dialog').close();state.orientation[state.caseType]={version:STUDY_ROLE_MEDIA.version,completed:true,videoCompleted:true,visibleMs:18000};state.reading=Object.fromEntries(StudyCore.DOSSIER_TABS.map(k=>[k,{confirmed:true,reachedEnd:true,visibleMs:8000}]));setStep('replay');});
 await p.waitForFunction(()=>document.querySelector('#judgment-audio').readyState>=2);
}
async function finishAudio(p){
 await p.evaluate(()=>document.querySelector('#judgment-audio').playbackRate=16);
 await p.locator('#playback-toggle').click();await p.waitForFunction(()=>state.audio.completed,{},{timeout:30000});
 assert.equal(await p.locator('#transcript-confirm').isEnabled(),true);
}
async function submit(p){
 await p.locator('#transcript-confirm').check();await p.locator('#to-decision').click();await p.locator('#to-survey').click();
 for(const id of ['judge','court','provider','system'])await p.locator('#responsibility-score-'+id).fill('50');await p.locator('#to-allocation').click();
 for(const id of ['judge','court','provider','system'])await p.locator('#responsibility-allocation-'+id).fill('25');
 for(const field of await p.locator('[data-rating]').all())await field.locator('[data-score="4"]').click();
 await p.locator('[name=manipulationCheck]').selectOption(await p.evaluate(()=>state.condition));await p.locator('[name=finalSigner]').selectOption('judge');await p.locator('[name=honestConfirm]').check();await p.locator('#submit-evaluation').click();
}
(async()=>{const b=await chromium.launch({headless:true});try{
 for(const caseType of ['natural','statutory'])for(const condition of ['none','procedural','substantive','decisional']){
  const c=await b.newContext({viewport:{width:390,height:844}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await setup(p,caseType,condition);
  assert.equal(await p.evaluate(()=>state.replay.mode),'audio');assert.match(await p.locator('#judgment-audio').getAttribute('src'),new RegExp(`${caseType}-${condition}-0923.mp3$`));assert.equal(await p.locator('#transcript-confirm').isDisabled(),true);
  await p.locator('#playback-toggle').click();await p.waitForFunction(()=>state.audio.positionSeconds>1.3);await p.locator('#playback-toggle').click();
  const partial=await p.locator('#narration-text p').allTextContents();assert.equal(partial.length,1);assert.ok(N.paragraphsFor(caseType,condition)[0].startsWith(partial[0]));assert.ok(partial[0].length>0);assert.equal(await p.locator(`.ai-inline-node.ai-node-${condition}`).count(),1);
  await p.waitForTimeout(300);assert.deepEqual(await p.locator('#narration-text p').allTextContents(),partial);
  const before=await p.evaluate(()=>({assignment:state.assignment,position:state.audio.positionSeconds}));await p.reload();await p.locator('#screen-replay.active').waitFor();await p.waitForFunction(()=>pendingAudioPosition===null&&document.querySelector('#judgment-audio').readyState>=2);
  assert.deepEqual(await p.evaluate(()=>state.assignment),before.assignment);assert.ok(Math.abs(await p.evaluate(()=>state.audio.positionSeconds)-before.position)<0.2);
  await finishAudio(p);assert.deepEqual(await p.locator('#narration-text p').allTextContents(),N.paragraphsFor(caseType,condition));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(caseType==='natural'&&condition==='substantive')await p.locator('.narration-record').screenshot({path:'../audio-0923/mobile-audio-substantive.png'});
  if(caseType==='natural'&&condition==='none'){
   await submit(p);await p.locator('#screen-between.active').waitFor();await p.locator('#next-case').click();await p.locator('#role-dialog[open]').waitFor();
   assert.equal(await p.evaluate(()=>state.caseType),'statutory');assert.equal(await p.evaluate(()=>state.condition),'none');assert.equal(await p.evaluate(()=>state.audio.completed),false);assert.match(await p.locator('#judgment-audio').getAttribute('src'),/statutory-none-0923.mp3$/);
   await p.evaluate(()=>{document.querySelector('#role-dialog').close();state.orientation[state.caseType]={version:STUDY_ROLE_MEDIA.version,completed:true,videoCompleted:true,visibleMs:18000};state.reading=Object.fromEntries(StudyCore.DOSSIER_TABS.map(k=>[k,{confirmed:true,reachedEnd:true,visibleMs:8000}]));setStep('replay');});await p.waitForFunction(()=>document.querySelector('#judgment-audio').readyState>=2);await finishAudio(p);await submit(p);await p.locator('#screen-debrief.active').waitFor();
   const responses=await p.evaluate(()=>state.session.responses);assert.equal(responses.length,2);for(const r of responses){assert.equal(r.narrationVersion,N.VERSION);assert.equal(r.presentation,'condition_audio_progressive_text');assert.ok(r.audio.completed);assert.match(r.audio.src,new RegExp(`${r.caseType}-none-0923.mp3$`));}
  }else{
   await p.locator('#playback-restart').click();await p.waitForFunction(()=>!state.audio.completed&&state.audio.positionSeconds<2);await p.locator('#playback-toggle').click();assert.equal(await p.locator('#transcript-confirm').isDisabled(),true);
  }
  assert.deepEqual(errors,[]);await c.close();console.log('Verified real audio, condition, progressive text, pause/resume, completion:',caseType,condition);
 }
 // Upgrade an unfinished text-only response without changing assignment or completed case data.
 const c=await b.newContext(),p=await c.newPage();await setup(p,'natural','procedural');
 const before=await p.evaluate(()=>{state.replay={mode:'text',version:'shared-narration-2026-09-16-v2',presentationVersion:'progressive-narration-2026-09-17-v1',completed:true,textReachedEnd:true,textVisibleMs:15000};state.step='survey';document.querySelector('#transcript-confirm').checked=true;document.querySelector('[name=fairness]').value='7';document.querySelector('#responsibility-score-judge').value='90';captureForm();saveDraft();return state.assignment;});
 await p.reload();await p.locator('#screen-replay.active').waitFor();assert.deepEqual(await p.evaluate(()=>state.assignment),before);assert.equal(await p.locator('[name=fairness]').inputValue(),'');assert.equal(await p.locator('#responsibility-score-judge').inputValue(),'');assert.equal(await p.evaluate(()=>state.audio.completed),false);assert.equal(await p.evaluate(()=>state.replay.mode),'audio');await c.close();console.log('Verified old unsubmitted draft resets to new audio without rerandomizing.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
