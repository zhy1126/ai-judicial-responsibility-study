const test=require('node:test'),assert=require('node:assert/strict');
const dialogue=require('../study-dialogue.js');
for(const caseType of ['natural','statutory'])for(const condition of ['none','procedural','substantive','decisional']){
 test(`${caseType}/${condition}: alternating interaction, bounded assistant authority and judge signature`,()=>{
  const messages=dialogue.messagesFor(caseType,condition);
  assert.equal(messages.length,13);assert.equal(messages.at(-1).role,'judge');
  for(let i=0;i<messages.length;i++){assert.equal(messages[i].role,i%2===0?'judge':condition==='none'?'clerk':'ai');assert.ok(messages[i].text.length>10);}
  const assistant=messages.filter(m=>m.role!=='judge').map(m=>m.text).join('\n');
  if(condition==='none')assert.ok(!messages.some(m=>m.role==='ai'));
  if(condition==='substantive')assert.ok(!/十五年|八个月|九万元|主文草案为|我建议认定/.test(assistant),'analysis cannot recommend a result');
  if(condition==='procedural')assert.ok(!/应按|构成自首|不能直接等同|我建议|主文草案为/.test(assistant),'procedural assistant cannot perform independent legal evaluation');
  if(condition==='decisional')assert.ok(assistant.includes('我建议认定')&&assistant.includes('主文草案为'));
  assert.ok(messages.at(-1).text.includes(caseType==='natural'?'有期徒刑十五年，剥夺政治权利三年':'有期徒刑八个月，并处罚金人民币九万元'));
 });
}
test('same-case final outcomes are identical in all conditions',()=>{
 for(const c of ['natural','statutory'])assert.equal(new Set(['none','procedural','substantive','decisional'].map(k=>dialogue.messagesFor(c,k).at(-1).text)).size,1);
});
test('unknown inputs fail without silently selecting a case',()=>{
 assert.throws(()=>dialogue.messagesFor('other','none'));assert.throws(()=>dialogue.messagesFor('natural','other'));
});
test('audio handoff contains every dialogue turn verbatim with the correct speaker',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../audio/dialogue-manifest.json'),'utf8'));
 assert.equal(manifest.version,dialogue.VERSION);assert.equal(manifest.recordings.length,8);
 for(const r of manifest.recordings){const m=dialogue.messagesFor(r.caseType,r.condition);assert.deepEqual(r.segments.map(s=>({role:s.role,stage:s.stage,text:s.text})),m);}
});
