const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const NARRATION=require('../study-narration.js'),StudyPlayback=require('../study-playback.js');
function harness(caseType,condition){
 const nodes={};const node=id=>nodes[id]||=( {innerHTML:'',textContent:'',checked:false,disabled:false,scrollTop:0,clientHeight:400,scrollHeight:2400,classList:{toggle(){}}} );
 const state={caseType,condition,step:'replay',replay:{textVisibleMs:0},audio:{started:true,completed:false,positionSeconds:3}};
 const context={state,NARRATION,StudyPlayback,qs:node,escapeHtml:s=>s};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function renderNarrationProgress('),source.indexOf('function updateAudioUI(')),context);
 return {state,node,context,tick(ms){state.replay.textVisibleMs=ms;context.renderNarrationProgress();context.checkNarrationEnd();}};
}
for(const caseType of ['natural','statutory'])for(const condition of ['none','procedural','substantive','decisional']){
 test(`${caseType}/${condition}: all text appears at eight seconds; continued audio does not block confirmation`,()=>{
  const h=harness(caseType,condition);h.tick(7750);assert.equal(h.state.replay.textRevealCompleted,false);assert.equal(h.node('#transcript-confirm').disabled,true);
  h.tick(8000);assert.equal(h.state.replay.textRevealCompleted,true);
  assert.ok(h.node('#narration-text').innerHTML.includes(NARRATION.paragraphsFor(caseType,condition).at(-1)));
  assert.equal(h.node('#transcript-confirm').disabled,true);assert.match(h.node('#narration-reading-status').textContent,/向下滚动/);
  h.node('#narration-text').scrollTop=2000;h.context.checkNarrationEnd();
  assert.equal(h.node('#transcript-confirm').disabled,false);assert.equal(h.state.audio.completed,false);
  assert.match(h.node('#audio-reading-status').textContent,/无需等录音结束/);
  assert.equal(h.node('#to-decision').disabled,true);h.node('#transcript-confirm').checked=true;h.context.updatePlaybackGate();
  assert.equal(h.node('#to-decision').disabled,false);assert.match(h.node('#narration-reading-status').textContent,/查看最终裁判/);
  assert.equal(h.state.replay.minTextMs,8000);
 });
}
test('audio loading, pause and errors never add waiting after the text has been read',()=>{
 for(const status of ['configured','available','error']){
  const h=harness('natural','substantive');h.state.audio={status,started:false,completed:false};h.tick(8000);
  h.node('#narration-text').scrollTop=2000;h.context.checkNarrationEnd();h.node('#transcript-confirm').checked=true;h.context.updatePlaybackGate();
  assert.equal(h.node('#to-decision').disabled,false);
 }
});
test('each case has an independent eight-second reading gate in either case order',()=>{
 for(const order of [['natural','statutory'],['statutory','natural']]){
  const h=harness(order[0],'substantive');h.tick(8000);h.node('#narration-text').scrollTop=2000;h.context.checkNarrationEnd();
  assert.equal(h.state.replay.completed,true);
  h.state.caseType=order[1];h.state.replay={textVisibleMs:0};h.node('#narration-text').scrollTop=0;h.node('#transcript-confirm').checked=false;
  h.tick(0);assert.equal(h.node('#transcript-confirm').disabled,true);h.tick(8000);
  h.node('#narration-text').scrollTop=2000;h.context.checkNarrationEnd();assert.equal(h.node('#transcript-confirm').disabled,false);
 }
});
