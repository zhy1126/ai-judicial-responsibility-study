const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../study-core.js');
test('current occupation alone determines lawyer screening without validity question',()=>{
 const a=core.assignParticipant({practicingLawyer:'yes',legalDegree:'yes'},{sessionId:'LAWYER',choose:x=>x[0]});
 assert.equal(a.role,'lawyer');assert.equal(a.background.licenseActive,null);
});
test('nonlawyers with no degree and no litigation experience enter either randomized lay role',()=>{
 for(const last of [false,true]){
  const a=core.assignParticipant({practicingLawyer:'no',judgeCaseExperience:'no',legalDegree:'no',litigationExperience:'no'},{sessionId:'LAY',choose:x=>last?x.at(-1):x[0]});
  assert.equal(a.role,last?'public':'litigant');
 }
});
test('all AI conditions use the same four responsibility actors',()=>{
 for(const condition of core.CONDITIONS){assert.deepEqual(core.subjectsFor(condition).map(x=>x.id),['judge','court','provider','system']);assert.equal(core.validRanking(['judge','court'],condition),false);}
});
test('reading must include minimum foreground exposure for each section',()=>{
 const progress=Object.fromEntries(core.DOSSIER_TABS.map(k=>[k,{reachedEnd:true,confirmed:true,visibleMs:5000}]));
 assert.equal(core.readingComplete(progress),true);
 assert.equal(core.readingComplete({...progress,task:{reachedEnd:true,confirmed:true,visibleMs:0}}),false);
});
