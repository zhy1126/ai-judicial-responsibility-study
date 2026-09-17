const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../study-playback.js');
test('text reveals progressively without exposing the full narrative in advance',()=>{
 const ps=['第一段陈述。','第二段陈述。'];assert.deepEqual(P.reveal(ps,0),[]);assert.equal(P.reveal(ps,.5).join(''),'第一段陈述。');assert.deepEqual(P.reveal(ps,1),ps);assert.deepEqual(P.reveal(ps,2),ps);
});
test('audio only reveals a fraction while playing; unknown duration never reveals prematurely',()=>{
 assert.equal(P.fraction(0,90),0);assert.equal(P.fraction(45,90),.5);assert.equal(P.fraction(90,NaN),0);assert.equal(P.fraction(0,0,true),1);assert.equal(P.fraction(100,90),1);
});
