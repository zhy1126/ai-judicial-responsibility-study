const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../study-core.js');
const scores={judge:90,court:80,provider:60,system:60};
test('independent responsibility scores preserve magnitude and ties without a sum constraint',()=>{
 assert.equal(typeof core.responsibilityValues,'function');
 assert.deepEqual(core.responsibilityValues(scores),scores);
 assert.deepEqual(core.responsibilityValues({judge:'0',court:'100',provider:'0',system:'100'}),{judge:0,court:100,provider:0,system:100});
 assert.deepEqual(core.responsibilityValues({judge:0,court:0,provider:0,system:0}),{judge:0,court:0,provider:0,system:0});
});
test('each responsibility score must be explicit, finite and an integer in 0–100',()=>{
 assert.equal(typeof core.responsibilityValues,'function');
 for(const value of ['',null,undefined,false,'unsure',-1,101,50.5,NaN,Infinity,'1e2','0x64'])assert.throws(()=>core.responsibilityValues({...scores,system:value}),/0.*100|填写/);
 assert.throws(()=>core.responsibilityValues({judge:1,court:2,provider:3}),/四个/);
 assert.throws(()=>core.responsibilityValues({...scores,extra:1}),/四个/);
});
test('allocation accepts zeros and requires exactly 100 without normalization',()=>{
 assert.equal(typeof core.responsibilityValues,'function');
 const answer={judge:70,court:30,provider:0,system:0};
 assert.deepEqual(core.responsibilityValues(answer,true),answer);
 for(const total of [0,99,101,400])assert.throws(()=>core.responsibilityValues({judge:total===400?100:Math.min(total,100),court:total===400?100:Math.max(0,total-100),provider:total===400?100:0,system:total===400?100:0},true),/合计.*100/);
 assert.throws(()=>core.responsibilityValues({judge:70,court:30,provider:0,system:''},true),/填写|0.*100/);
 assert.equal(answer.judge,70);
});
