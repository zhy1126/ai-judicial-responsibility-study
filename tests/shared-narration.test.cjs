const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const N=require('../study-narration.js');
test('each case has one unchanged first-person narrative for all AI conditions',()=>{
 for(const caseType of ['natural','statutory']){
  const text=N.paragraphsFor(caseType);assert.equal(text.length,5);assert.ok(text.every(p=>typeof p==='string'&&p.length>20));
  assert.doesNotMatch(text.join(''),/AI|人工智能|系统|书记员/);
  for(const condition of ['none','procedural','substantive','decisional'])assert.deepEqual(N.paragraphsFor(caseType,condition),text);
 }
 assert.match(N.paragraphsFor('natural').at(-1),/十五年，剥夺政治权利三年/);
 assert.match(N.paragraphsFor('statutory').at(-1),/八个月，并处罚金人民币九万元/);
});
test('four disclosures are distinct, while litigant framing matches the harmed side in both cases',()=>{
 assert.equal(new Set(['none','procedural','substantive','decisional'].map(N.conditionLine)).size,4);
 assert.match(N.rolePrompt('litigant','natural'),/被害人的近亲属/);
 assert.match(N.rolePrompt('litigant','statutory'),/著作权方/);
 assert.match(N.rolePrompt('public','natural'),/没有直接关系/);
 assert.throws(()=>N.paragraphsFor('missing'));assert.throws(()=>N.conditionLine('missing'));
});
test('audio is keyed only by case and old dialogue scripts are not loaded by the page',()=>{
 const scope={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../audio-config.js'),'utf8'),scope);
 assert.deepEqual(Object.keys(scope.window.STUDY_AUDIO),['natural','statutory']);
 assert.ok(Object.values(scope.window.STUDY_AUDIO).every(x=>typeof x==='string'));
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 assert.doesNotMatch(html,/src="\.\/study-(dialogue|stream)\.js"|id="license-question"|id="retain-response"|id="chat-stream"/);
 assert.match(html,/id="narration-text"/);
});
test('case-specific role videos cover six variants without AI-condition branches',()=>{
 const scope={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../role-media.js'),'utf8'),scope);
 const m=scope.window.STUDY_ROLE_MEDIA;assert.equal(m.durationSeconds,18);
 assert.deepEqual(Object.keys(m.cases),['natural','statutory']);
 const urls=[];for(const c of ['natural','statutory'])for(const role of ['lawyer','litigant','public']){const clip=m.cases[c][role];assert.match(clip.src,new RegExp(`${c}-${role}-v3\\.mp4$`));urls.push(clip.src);assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',clip.src)));assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',clip.poster)));}
 assert.equal(new Set(urls).size,6);assert.match(m.version,/case-role-broll/);
});
