const {fillBackground}=require('./browser-helpers.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
const{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8766',recordsKey='judicial_ai_responsibility_prototype_records_v1';
const ids=['judge','court','provider','system'];
const scores={judge:90,court:80,provider:60,system:60},allocation={judge:70,court:30,provider:0,system:0};
async function fill(p,kind,values){for(const id of ids)await p.locator(`#responsibility-${kind}-${id}`).fill(String(values[id]));}
// Isolate this questionnaire test from media timing; the narration flow covers actual exposure.
async function surveyFixture(p){await p.evaluate(()=>{
 document.querySelector('#role-dialog').close();state.orientation[state.caseType]={version:STUDY_ROLE_MEDIA.version,completed:true,videoCompleted:true,videoMax:18,visibleMs:18000};
 state.reading=Object.fromEntries(StudyCore.DOSSIER_TABS.map(k=>[k,{confirmed:true,reachedEnd:true,visibleMs:6000}]));
 state.replay={mode:'text',version:StudyNarration.VERSION,presentationVersion:StudyPlayback.VERSION,textRevealCompleted:true,completed:true,textReachedEnd:true,textVisibleMs:40000};
 document.querySelector('#transcript-confirm').checked=true;updatePlaybackGate();setStep('survey');
 });}
async function otherAnswers(p){await p.locator('[name=manipulationCheck]').selectOption('none');await p.locator('[name=finalSigner]').selectOption('judge');for(const n of ['fairness','control','clarity','judgeOwnership','aiTrust','legitimacy','acceptance','unease','involvement'])await p.locator(`[data-rating=${n}] [data-score="4"]`).click();await p.locator('[name=honestConfirm]').check();}
function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if(ch==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=ch;}if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
(async()=>{const b=await chromium.launch({headless:true});try{
 const c=await b.newContext({viewport:{width:390,height:844}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/?view=participant&preview=1&role=public&condition=none&case=natural');await fillBackground(p);await p.locator('#consent-checkbox').check();await p.locator('#start-study').click();await surveyFixture(p);
 const assignment=await p.evaluate(()=>state.assignment),order=await p.evaluate(()=>state.responsibilityOrder);
 assert.equal(await p.locator('#ranking-list').count(),0);assert.equal(await p.locator('#responsibility-score-list input').count(),4);assert.equal(await p.locator('#responsibility-allocation').isVisible(),false);assert.equal(await p.locator('#to-allocation').isDisabled(),true);
 assert.deepEqual(await p.locator('#responsibility-score-list input').evaluateAll(xs=>xs.map(x=>x.value)),['','','','']);
 await fill(p,'score',scores);await p.locator('#responsibility-score-system').fill('101');assert.equal(await p.locator('#to-allocation').isDisabled(),true);await p.locator('#responsibility-score-system').fill('60');
 await p.reload();await p.locator('#screen-survey.active').waitFor();assert.deepEqual(await p.evaluate(()=>responsibilityInput('score')),{judge:'90',court:'80',provider:'60',system:'60'});assert.deepEqual(await p.evaluate(()=>state.responsibilityOrder),order);assert.deepEqual(await p.evaluate(()=>state.assignment),assignment);
 await p.locator('#responsibility-independent').screenshot({path:'../../work/responsibility-independent-mobile.png'});
 await p.locator('#to-allocation').click();assert.equal(await p.locator('#responsibility-independent').isVisible(),false);assert.deepEqual(await p.locator('#responsibility-allocation-list input').evaluateAll(xs=>xs.map(x=>x.value)),['','','','']);
 await otherAnswers(p);await fill(p,'allocation',{judge:70,court:29,provider:0,system:0});assert.match(await p.locator('#allocation-status').innerText(),/还差 1 分/);assert.equal(await p.locator('#submit-evaluation').isDisabled(),true);
 await p.locator('#survey-form').evaluate(f=>f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true})));assert.match(await p.locator('#survey-error').innerText(),/合计 100/);assert.equal(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]').length,recordsKey),0);
 await p.locator('#responsibility-allocation-court').fill('31');assert.match(await p.locator('#allocation-status').innerText(),/超出 1 分/);assert.equal(await p.locator('#submit-evaluation').isDisabled(),true);
 await p.locator('#responsibility-allocation-court').fill('30');await p.locator('#responsibility-allocation-system').fill('');assert.equal(await p.locator('#submit-evaluation').isDisabled(),true);await p.locator('#responsibility-allocation-system').fill('0');
 await p.reload();await p.locator('#screen-survey.active').waitFor();assert.equal(await p.locator('#responsibility-allocation').isVisible(),true);assert.deepEqual(await p.evaluate(()=>responsibilityInput('allocation')),{judge:'70',court:'30',provider:'0',system:'0'});
 await p.locator('#back-to-scores').click();assert.equal(await p.locator('#submit-evaluation').isDisabled(),true);await p.locator('#responsibility-score-judge').fill('95');await p.locator('#to-allocation').click();assert.equal(await p.locator('#responsibility-allocation-judge').inputValue(),'70');await p.locator('#responsibility-allocation').screenshot({path:'../../work/responsibility-allocation-mobile.png'});
 await p.locator('#submit-evaluation').click();await p.locator('#screen-between.active').waitFor();
 let record=await p.evaluate(k=>JSON.parse(localStorage.getItem(k))[0],recordsKey);assert.deepEqual(record.responses[0].responsibilityScores,{...scores,judge:95});assert.deepEqual(record.responses[0].responsibilityAllocation,allocation);assert.equal(record.responses[0].responsibilityAllocationTotal,100);assert.equal(record.responses[0].rankingIds,undefined);
 await p.locator('#next-case').click();await surveyFixture(p);assert.equal(await p.evaluate(()=>state.caseType),'statutory');assert.deepEqual(await p.locator('#responsibility-score-list input').evaluateAll(xs=>xs.map(x=>x.value)),['','','','']);assert.deepEqual(await p.locator('#responsibility-allocation-list input').evaluateAll(xs=>xs.map(x=>x.value)),['','','','']);
 await fill(p,'score',{judge:100,court:100,provider:100,system:100});await p.locator('#to-allocation').click();await fill(p,'allocation',{judge:0,court:0,provider:100,system:0});await otherAnswers(p);await p.locator('#submit-evaluation').click();await p.locator('#screen-debrief.active').waitFor();record=await p.evaluate(k=>JSON.parse(localStorage.getItem(k))[0],recordsKey);assert.equal(record.responses.length,2);assert.equal(record.completed,true);
 // Legacy rankings remain unchanged, their new score columns stay empty in CSV.
 const legacy={version:'2.2.0',sessionId:'OLD-RANK',caseType:'natural',role:'public',condition:'none',rankingStatus:'rank',rankingIds:['court','judge','provider','system'],ranking:['案件所在法院','承办法官／审判团队','AI 技术提供方','AI 系统本身'],ratings:{fairness:4},submittedAt:'2026-09-15T00:00:00Z'};
 await p.evaluate(({k,r})=>{const xs=JSON.parse(localStorage.getItem(k));xs.push(r);localStorage.setItem(k,JSON.stringify(xs));},{k:recordsKey,r:legacy});await p.goto(base+'/?view=researcher');assert.equal(await p.locator('#metric-judge-allocation').innerText(),'35.0 分');
 const download= p.waitForEvent('download');await p.locator('#export-csv').click();const file=await download;const csv=parseCsv(fs.readFileSync(await file.path(),'utf8').replace(/^\uFEFF/,'')),header=csv[0],rows=csv.slice(1).map(cells=>Object.fromEntries(header.map((h,i)=>[h,cells[i]])));assert.ok(csv.every(row=>row.length===header.length));
 assert.equal(rows[0].legal_industry,'no');assert.equal(rows[0].legal_occupation,'');assert.equal(rows[0].responsibility_score_judge,'95');assert.equal(rows[0].responsibility_allocation_judge,'70');assert.equal(rows[1].responsibility_allocation_judge,'0');assert.equal(rows[2].responsibility_measure,'ranking_legacy');assert.equal(rows[2].responsibility_score_judge,'');assert.deepEqual(JSON.parse(rows[2].ranking_ids),legacy.rankingIds);assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).at(-1),recordsKey),legacy);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await c.close();
 // A draft from the immediately preceding ranking version keeps exposure and other answers.
 const c2=await b.newContext(),p2=await c2.newPage();await p2.goto(base+'/?view=participant&preview=1&role=lawyer&condition=substantive&case=statutory');await fillBackground(p2);await p2.locator('#consent-checkbox').check();await p2.locator('#start-study').click();await surveyFixture(p2);
 const legacyDraft=await p2.evaluate(()=>{
   const d=snapshot(),oldEpoch='ranking-before-dual-test';d.epoch=oldEpoch;
   delete d.responsibilityMeasure;delete d.responsibilityOrder;delete d.responsibilityStage;
   d.ranking=['system','provider','court','judge'];d.rankingInitial=['court','judge','provider','system'];d.formValues={fairness:'6',rankingConfirm:true};
   sessionStorage.setItem(draftKey,JSON.stringify(d));localStorage.setItem(EPOCH_KEY,oldEpoch);localStorage.setItem(PROTOCOL_KEY,JSON.stringify({protocol:'case-role-broll-2026-09-16-v5',phase:'complete'}));return d;
 });
 await p2.reload();await p2.locator('#screen-survey.active').waitFor();assert.equal(await p2.locator('#role-dialog').evaluate(d=>d.open),false);assert.deepEqual(await p2.evaluate(()=>state.assignment),legacyDraft.assignment);assert.deepEqual(await p2.evaluate(()=>state.reading),legacyDraft.reading);assert.equal(await p2.locator('[name=fairness]').inputValue(),'6');assert.equal(await p2.evaluate(()=>state.responsibilityStage),'independent');assert.deepEqual(await p2.evaluate(()=>state.responsibilityOrder),legacyDraft.rankingInitial);assert.deepEqual(await p2.locator('#responsibility-score-list input').evaluateAll(xs=>xs.map(x=>x.value)),['','','','']);await c2.close();
 console.log('Passed: sequential scales, blank/zero distinction, 99/100/101 gating, submit validation, refresh/back, fresh second case, exact saved scores and allocations, CSV and unchanged legacy ranking.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
