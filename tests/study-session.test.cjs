const test=require('node:test');const assert=require('node:assert/strict');
let session;try{session=require('../study-session.js');}catch{session={};}
const assignment={sessionId:'PAIR-1',caseType:'natural',role:'lawyer',condition:'procedural',preview:false};
const answer=caseType=>({version:'2.1.0',...assignment,caseType,ratings:{fairness:4},openResponse:caseType,submittedAt:'2026-09-08T00:00:00Z'});
test('both first-case draws include every case exactly once',()=>{
 assert.equal(typeof session.create,'function');
 for(const first of ['natural','statutory']){const s=session.create({...assignment,caseType:first});assert.equal(s.caseOrder[0],first);assert.deepEqual([...s.caseOrder].sort(),['natural','statutory']);assert.equal(session.complete(s),false);}
});
test('each case must be answered in order before final completion',()=>{
 assert.equal(typeof session.submit,'function');let s=session.create(assignment);
 assert.throws(()=>session.advance(s));assert.throws(()=>session.submit(s,answer('statutory'),assignment));
 s=session.submit(s,answer('natural'),assignment);assert.equal(session.complete(s),false);assert.throws(()=>session.submit(s,answer('natural'),assignment));
 s=session.advance(s);assert.equal(s.caseIndex,1);s=session.submit(s,answer('statutory'),assignment);assert.equal(session.complete(s),true);assert.throws(()=>session.advance(s));assert.equal(s.responses[0].openResponse,'natural');
});
test('answers retain one identity, role and AI condition',()=>{
 assert.equal(typeof session.submit,'function');const s=session.create(assignment);
 for(const patch of [{sessionId:'OTHER'},{condition:'decisional'},{role:'public'}])assert.throws(()=>session.submit(s,{...answer('natural'),...patch},assignment));
});
test('legacy completed and unfinished drafts continue without rerandomization',()=>{
 assert.equal(typeof session.restore,'function');const old=answer('natural');
 const s=session.restore(assignment,{response:old});assert.deepEqual(s.responses,[old]);assert.equal(s.caseIndex,0);assert.equal(session.complete(s),false);assert.equal(s.migratedFrom,'single_case');
 assert.deepEqual(session.restore(assignment,{}).responses,[]);
 assert.deepEqual(session.restore(assignment,{session:s}),s);
 assert.throws(()=>session.restore(assignment,{session:{...s,caseOrder:['natural','natural']}}));
});
test('one envelope keeps separate answer rows and explicit incomplete status',()=>{
 assert.equal(typeof session.record,'function');let s=session.submit(session.create(assignment),answer('natural'),assignment);
 let record=session.record(s,assignment);assert.equal(record.completed,false);assert.equal(record.responses.length,1);assert.equal(session.rows([record])[0].studyCompleted,false);
 s=session.submit(session.advance(s),answer('statutory'),assignment);record=session.record(s,assignment,true);
 assert.equal(record.completed,true);assert.equal(record.retained,true);const rows=session.rows([record]);assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.caseNumber),[1,2]);assert.ok(rows.every(r=>r.sessionId==='PAIR-1'&&r.studyCompleted===true&&r.retained===true));
 const legacy=answer('natural');assert.equal(session.rows([legacy])[0].studyProtocol,'single_case');assert.equal(legacy.studyProtocol,undefined);
});
