const test = require('node:test');
const assert = require('node:assert/strict');
let core;
try { core = require('../study-core.js'); } catch { core = {}; }
const answers = { practicingLawyer: 'no', licenseActive: null, legalEducation: 'yes', litigationExperience: 'yes' };
test('only current active practising lawyers receive lawyer role; real history remains separate', () => {
  assert.equal(typeof core.assignParticipant, 'function');
  const a = core.assignParticipant({...answers, practicingLawyer:'yes', licenseActive:'yes'}, {choose:x=>x[0],sessionId:'A'});
  assert.equal(a.role, 'lawyer');
  assert.equal(a.background.legalEducation, 'yes');
  const b = core.assignParticipant(answers, {choose:x=>x.at(-1),sessionId:'B'});
  assert.equal(b.role, 'public');
  assert.equal(b.background.litigationExperience, 'yes');
  assert.equal(core.assignParticipant({...answers,practicingLawyer:'yes',licenseActive:'no'},{choose:x=>x[0],sessionId:'C'}).role,'litigant');
});
test('an existing assignment survives reload or repeated submission without new random draws', () => {
  assert.equal(typeof core.assignParticipant, 'function');
  const a=core.assignParticipant(answers,{choose:x=>x[0],sessionId:'A'});
  const b=core.assignParticipant(answers,{existing:JSON.parse(JSON.stringify(a)),choose:()=>{throw Error('rerandomized');},sessionId:'B'});
  assert.deepEqual(a,b);
});
test('unanswered or inconsistent screening cannot create assignment', () => {
  assert.equal(typeof core.assignParticipant, 'function');
  assert.throws(()=>core.assignParticipant({...answers,legalEducation:null},{sessionId:'A'}));
  assert.throws(()=>core.assignParticipant({...answers,practicingLawyer:'yes',licenseActive:null},{sessionId:'A'}));
});
test('no-AI omits inapplicable technical actors and the system is distinct from its provider',()=>{
  assert.equal(typeof core.subjectsFor, 'function');
  assert.deepEqual(core.subjectsFor('none').map(x=>x.id),['judge','court']);
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
  assert.equal(core.validRanking(['court','judge'],'none'),true);
  assert.equal(core.validRanking(['judge','judge'],'none'),false);
  assert.equal(core.validRanking(['judge','court','system'],'none'),false);
});
