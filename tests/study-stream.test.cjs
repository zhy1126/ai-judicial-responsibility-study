const test=require('node:test');
const assert=require('node:assert/strict');
const stream=require('../study-stream.js');
function fixture(initial){
  let time=0,tick,view;
  const player=stream.create({paragraphs:['甲乙丙','丁戊'],initial,now:()=>time,setInterval:fn=>(tick=fn,1),clearInterval:()=>tick=null,onUpdate:x=>view=x});
  return {player,view:()=>view,advance:ms=>{while(ms>0){const delta=Math.min(50,ms);time+=delta;ms-=delta;tick?.();}},stall:ms=>{time+=ms;tick?.();}};
}
test('starts on user action, streams in order and retains only the current paragraph',()=>{
  const f=fixture();f.advance(5000);assert.equal(f.view().text,'');
  f.player.start();f.advance(100);assert.equal(f.view().text,'甲乙');
  f.advance(1250);assert.equal(f.view().index,1);assert.equal(f.view().text,'');
  f.advance(100);assert.equal(f.view().text,'丁戊');assert.ok(!f.view().text.includes('甲'));
  f.advance(1200);assert.equal(f.view().completed,true);assert.equal(f.view().text,'');
});
test('pause stops exposure and resume continues without skipping; reset starts over',()=>{
  const f=fixture();f.player.start();f.advance(100);f.player.pause();
  f.advance(9000);assert.equal(f.view().text,'甲乙');assert.equal(f.view().running,false);
  f.player.start();f.advance(50);assert.equal(f.view().text,'甲乙丙');
  f.player.reset();assert.equal(f.view().text,'');assert.equal(f.view().running,false);
});
test('refresh restores position but never resumes autoplay',()=>{
  const first=fixture();first.player.start();first.advance(1400);
  const second=fixture(first.player.getSnapshot());assert.equal(second.view().text,'丁');
  second.advance(20000);assert.equal(second.view().completed,false);
  second.player.start();second.advance(1250);assert.equal(second.view().completed,true);
});
test('a long event-loop stall cannot skip unrendered paragraphs or complete playback',()=>{
  const f=fixture();f.player.start();f.advance(50);f.stall(90000);
  assert.equal(f.view().index,0);assert.equal(f.view().completed,false);assert.equal(f.view().text,'甲乙丙');
});
