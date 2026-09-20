const test=require('node:test'),assert=require('node:assert/strict'),core=require('../study-core.js');
const base={legalIndustry:'no',legalDegree:'no',judgeCaseExperience:'no',litigationExperience:'no'};
const make=(data,options={})=>core.assignParticipant({...base,...data},{sessionId:'BG',choose:x=>x[0],...options});
test('industry first, actual profession second; degree is recorded but never used as group eligibility',()=>{
 for(const legalDegree of ['yes','no']){
  const lawyer=make({legalIndustry:'yes',legalOccupation:'lawyer',legalDegree});assert.equal(lawyer.role,'lawyer');assert.equal(lawyer.background.practicingLawyer,'yes');
  const judge=make({legalIndustry:'yes',legalOccupation:'judge',judgeCaseExperience:'yes',legalDegree});assert.equal(judge.role,'judge');
  assert.equal(make({legalDegree}).role,'litigant');
 }
 assert.throws(()=>make({legalIndustry:null}));assert.throws(()=>make({legalIndustry:'yes'}));assert.throws(()=>make({legalIndustry:'yes',legalOccupation:'public'}));
});
test('other legal work requires specific occupation and free text when other is selected',()=>{
 for(const detail of ['corporate','judge_assistant','court_support','prosecution','lawyer_assistant','academic','other']){
  const a=make({legalIndustry:'yes',legalOccupation:'other',legalOccupationDetail:detail,legalOccupationOther:detail==='other'?'法律援助机构行政工作':''});
  assert.equal(a.background.legalOccupationDetail,detail);assert.equal(a.backgroundGroup,detail==='judge_assistant'?'judge':'public');
 }
 assert.throws(()=>make({legalIndustry:'yes',legalOccupation:'other'}));assert.throws(()=>make({legalIndustry:'yes',legalOccupation:'other',legalOccupationDetail:'other',legalOccupationOther:'   '}));
});
test('hidden fields are discarded, prior judge experience remains eligible, public viewpoints remain random',()=>{
 const a=make({legalOccupation:'lawyer',legalOccupationDetail:'corporate',legalOccupationOther:'旧答案'});assert.equal(a.role,'litigant');assert.equal(a.background.legalOccupation,null);assert.equal(a.background.legalOccupationDetail,null);assert.equal(a.background.legalOccupationOther,null);
 assert.equal(make({judgeCaseExperience:'yes'}).role,'judge');
 assert.equal(make({}, {choose:x=>x.at(-1)}).role,'public');
});

test('judges and judge assistants share one group without requiring prior judge experience',()=>{
 for(const judgeCaseExperience of ['no',null]){
  assert.equal(make({legalIndustry:'yes',legalOccupation:'judge',judgeCaseExperience}).role,'judge');
  assert.equal(make({legalIndustry:'yes',legalOccupation:'other',legalOccupationDetail:'judge_assistant',judgeCaseExperience}).role,'judge');
 }
});

test('four-choice screening maps legal backgrounds and randomizes only the public perspective pool',()=>{
 const choices=['judge','legal_other','lawyer','other'];
 for(const backgroundChoice of choices){
  const a=core.assignParticipant({backgroundChoice},{sessionId:'FOUR',choose:x=>x[0]});
  assert.equal(a.background.backgroundChoice,backgroundChoice);
  assert.equal(a.backgroundGroup,backgroundChoice==='judge'?'judge':backgroundChoice==='lawyer'?'lawyer':'public');
  assert.equal(a.role,backgroundChoice==='judge'?'judge':backgroundChoice==='lawyer'?'lawyer':'litigant');
 }
 const publicRole=core.assignParticipant({backgroundChoice:'other'},{sessionId:'FOUR-P',choose:x=>x.at(-1)});
 assert.equal(publicRole.role,'public');
 assert.throws(()=>core.assignParticipant({backgroundChoice:'unknown'},{sessionId:'BAD'}));
});

test('new dossier reading gate is eight seconds',()=>{
 assert.equal(core.MIN_READING_MS,8000);
 const progress=Object.fromEntries(core.DOSSIER_TABS.map(k=>[k,{reachedEnd:true,confirmed:true,visibleMs:7999}]));
 assert.equal(core.readingComplete(progress),false);
 for(const tab of core.DOSSIER_TABS)progress[tab].visibleMs=8000;
 assert.equal(core.readingComplete(progress),true);
});
