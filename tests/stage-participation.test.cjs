const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../study-narration.js'),body=require('./fixtures/narration-0916.json');
test('both cases explain condition-specific participation where material, analysis and result stages appear',()=>{
 for(const c of ['natural','statutory'])for(const k of ['none','procedural','substantive','decisional']){
  const nodes=N.participationNodesFor(k,c),stages=nodes.filter(n=>n.paragraph>0);
  assert.deepEqual(stages.map(n=>n.stage),['materials','analysis','result']);
  assert.deepEqual(stages.map(n=>n.paragraph),c==='natural'?[1,2,5]:[1,3,6]);
  assert.ok(stages.every(n=>n.label&&n.title&&n.kind===k));
  assert.deepEqual(N.paragraphsFor(c,k).slice(1),body[c],'stage notes must not silently replace approved spoken words');
 }
});
test('stage notes distinguish assistance from result recommendations without changing case outcomes',()=>{
 for(const c of ['natural','statutory']){
  const notes=k=>N.participationNodesFor(k,c).filter(n=>n.paragraph>0);
  assert.ok(notes('none').every(n=>/未使用 AI/.test(n.label)));
  assert.match(notes('procedural')[0].label,/AI.*整理.*核对/);
  assert.match(notes('procedural')[1].label,/AI 未参与/);
  assert.match(notes('substantive')[1].label,/AI.*证据.*法律/);
  assert.match(notes('substantive')[2].label,/没有.*裁判结果建议.*未.*裁判主文草案/);
  assert.match(notes('decisional')[2].label,/AI.*裁判结果建议.*裁判主文草案/);
 }
});
test('scenario has a three-second minimum independent of media completion',()=>{
 assert.equal(N.MIN_ROLE_MS,3000);
});
