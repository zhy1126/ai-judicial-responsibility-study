const test = require('node:test');
const assert = require('node:assert/strict');
let core;
try { core = require('../study-core.js'); } catch { core = {}; }
const answers = { legalIndustry:'no',practicingLawyer:'no', judgeCaseExperience: 'no', licenseActive: null, legalDegree: 'yes', litigationExperience: 'yes' };
test('current self-reported practising lawyers receive lawyer role; real history remains separate', () => {
  assert.equal(typeof core.assignParticipant, 'function');
  const a = core.assignParticipant({...answers, legalIndustry:'yes',legalOccupation:'lawyer',practicingLawyer:'yes', licenseActive:'yes'}, {choose:x=>x[0],sessionId:'A'});
  assert.equal(a.role, 'lawyer');
  assert.equal(a.background.legalDegree, 'yes');
  assert.equal(a.background.litigationExperience, null);
  assert.equal(a.background.litigationExperienceStatus, 'not_asked_lawyer_branch');
  const b = core.assignParticipant(answers, {choose:x=>x.at(-1),sessionId:'B'});
  assert.equal(b.role, 'public');
  assert.equal(b.background.litigationExperience, 'yes');
  assert.equal(core.assignParticipant({...answers,legalIndustry:'yes',legalOccupation:'lawyer',practicingLawyer:'yes'},{choose:x=>x[0],sessionId:'C'}).role,'lawyer');
});
test('an existing assignment survives reload or repeated submission without new random draws', () => {
  assert.equal(typeof core.assignParticipant, 'function');
  const a=core.assignParticipant(answers,{choose:x=>x[0],sessionId:'A'});
  const b=core.assignParticipant(answers,{existing:JSON.parse(JSON.stringify(a)),choose:()=>{throw Error('rerandomized');},sessionId:'B'});
  assert.deepEqual(a,b);
});
test('unanswered or inconsistent screening cannot create assignment', () => {
  assert.equal(typeof core.assignParticipant, 'function');
  assert.throws(()=>core.assignParticipant({...answers,legalDegree:null},{sessionId:'A'}));
  assert.throws(()=>core.assignParticipant({...answers,legalIndustry:null},{sessionId:'A'}));
});
test('lawyer branch skips litigation history; switching to a non-lawyer requires it',()=>{
  assert.equal(core.assignParticipant({...answers,legalIndustry:'yes',legalOccupation:'lawyer',practicingLawyer:'yes',licenseActive:'yes',litigationExperience:null},{choose:x=>x[0],sessionId:'A'}).role,'lawyer');
  assert.throws(()=>core.assignParticipant({...answers,litigationExperience:null},{sessionId:'B'}));
  assert.throws(()=>core.assignParticipant({...answers,legalDegree:undefined,legalEducation:'yes'},{sessionId:'C'}),'old education does not imply a degree');
});
test('reading requires each distinct section to reach its end and be confirmed',()=>{
  const complete={overview:{reachedEnd:true,confirmed:true,visibleMs:8000},evidence:{reachedEnd:true,confirmed:true,visibleMs:8000},task:{reachedEnd:true,confirmed:true,visibleMs:8000}};
  assert.equal(core.readingComplete(complete),true);
  assert.equal(core.readingComplete({...complete,evidence:{reachedEnd:false,confirmed:true}}),false);
  assert.equal(core.readingComplete({...complete,task:{reachedEnd:true,confirmed:false}}),false);
  assert.equal(core.readingComplete(['overview','evidence','task']),false,'old tab visits are not completed reading');
});
test('every condition includes the system and its provider as separate actors',()=>{
  assert.equal(typeof core.subjectsFor, 'function');
  assert.deepEqual(core.subjectsFor('none').map(x=>x.id),['judge','court','provider','system']);
  assert.deepEqual(core.subjectsFor('decisional').map(x=>x.id),['judge','court','provider','system']);
});
test('unknown, not applicable and neutral have distinct encodings; blank is invalid',()=>{
  assert.equal(typeof core.ratingValue,'function');
  assert.deepEqual(core.ratingValue('4'),{value:4,status:'answered'});
  assert.deepEqual(core.ratingValue('unsure'),{value:null,status:'unsure'});
  assert.deepEqual(core.ratingValue(null,false),{value:null,status:'not_applicable'});
  assert.throws(()=>core.ratingValue(null));
  assert.throws(()=>core.ratingValue('8'));
});
test('ranking validates exact applicable membership with no duplicates',()=>{
  assert.equal(typeof core.validRanking,'function');
  assert.equal(core.validRanking(['court','judge','provider','system'],'none'),true);
  assert.equal(core.validRanking(['judge','judge'],'none'),false);
  assert.equal(core.validRanking(['judge','court','system'],'none'),false);
});

test('judge experience creates judge group; current lawyers have priority; lay backgrounds do not decide their simulated role',()=>{
 for(const legalDegree of ['yes','no'])for(const litigationExperience of ['yes','no']){
  const a=core.assignParticipant({...answers,judgeCaseExperience:'yes',legalDegree,litigationExperience},{sessionId:'J',choose:x=>x[0]});
  assert.equal(a.role,'judge');assert.equal(a.backgroundGroup,'judge');assert.equal(a.background.litigationExperience,null);assert.equal(a.screeningVersion,core.SCREENING_VERSION);
  const l=core.assignParticipant({...answers,legalIndustry:'yes',legalOccupation:'lawyer',practicingLawyer:'yes',judgeCaseExperience:'yes'},{sessionId:'L',choose:x=>x[0]});assert.equal(l.role,'lawyer');assert.equal(l.backgroundGroup,'lawyer');
  for(const last of [false,true]){const p=core.assignParticipant({...answers,legalDegree,litigationExperience},{sessionId:'P',choose:x=>last?x.at(-1):x[0]});assert.equal(p.backgroundGroup,'public');assert.equal(p.role,last?'public':'litigant');}
 }
 assert.throws(()=>core.assignParticipant({...answers,judgeCaseExperience:null},{sessionId:'B'}));
});
test('rescreening preserves ID, AI condition and case order, and does not redraw an unchanged lay role',()=>{
 const existing=core.assignParticipant(answers,{sessionId:'KEEP',choose:x=>x.at(-1)});delete existing.screeningVersion;
 const j=core.assignParticipant({...answers,judgeCaseExperience:'yes'},{existing,rescreen:true,sessionId:'NEW',choose:()=>{throw Error('unexpected draw');}});
 assert.equal(j.role,'judge');for(const key of ['sessionId','condition','caseType'])assert.equal(j[key],existing[key]);
 const p=core.assignParticipant(answers,{existing,rescreen:true,sessionId:'NEW',choose:()=>{throw Error('unexpected draw');}});assert.equal(p.role,existing.role);
});
