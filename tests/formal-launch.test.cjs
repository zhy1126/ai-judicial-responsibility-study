const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const config=fs.readFileSync(require.resolve('../collection-config.js'),'utf8');
const CORE=require('../study-core.js'),SESSION=require('../study-session.js');

test('shared root, revision links and unknown views all open the questionnaire; researcher view is explicit',()=>{
 for(const search of ['', '?revision=formal-launch', '?view=participant', '?view=unknown', '?view=participant&preview=1', '?view=researcher']){
  const shown=[],calls=[],context={params:new URLSearchParams(search),prepareProtocol(){},prepareCollectionUI(){},bindResearcher(){},renderRecords(){},setupParticipant(){calls.push('participant')},qs:s=>({classList:{remove(){shown.push(s)}}})};
  vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function init(){'),source.indexOf('function prepareCollectionUI(){')),context);context.init();
  const researcher=search==='?view=researcher';assert.deepEqual(shown,[researcher?'#researcher-view':'#participant-view']);assert.equal(calls.length,researcher?0:1);
 }
});

function bootstrap(search,mode){
 const context={URLSearchParams,location:{search},performance:{now:()=>0},localStorage:{getItem:()=>null},window:{StudyCore:CORE,StudyContent:{cases:{}},StudySession:SESSION},document:{},StudyCollection:{create:o=>o},valid:(v,values,fallback)=>values.includes(v)?v:fallback};
 vm.createContext(context);vm.runInContext(config,context);if(mode)context.window.STUDY_COLLECTION.mode=mode;
 vm.runInContext(source.slice(0,source.indexOf('\ninit();')),context);
 return vm.runInContext('({central,draftKey,collection,preview:state.preview,mode:collectionSettings.mode})',context);
}
test('formal credentials and progress cannot reuse pilot or preview state',()=>{
 const formal=bootstrap(''),pilot=bootstrap('','pilot'),preview=bootstrap('?view=participant&preview=1');
 assert.equal(formal.mode,'formal');assert.equal(formal.central,true);assert.notEqual(formal.draftKey,pilot.draftKey);assert.notEqual(formal.collection.key,pilot.collection.key);
 assert.equal(preview.central,false);assert.equal(preview.collection,null);assert.notEqual(formal.draftKey,preview.draftKey);
});

test('the real start handler requests formal assignment and only proceeds after the server confirms it',async()=>{
 const calls=[],nodes={},node=s=>nodes[s]||=( {checked:true,value:'lawyer',textContent:'',disabled:false} );
 const state={preview:false},assignment=CORE.assignParticipant({backgroundChoice:'lawyer'},{sessionId:'FORMAL',choose:xs=>xs[0]});
 const context={state,draftBlocked:false,qs:node,currentEpoch:()=>true,draftStorage:()=>({getItem:()=>null,setItem(){}}),draftKey:'formal',storageEpoch:'',central:true,collectionSettings:{mode:bootstrap('').mode},collection:{start:async(...args)=>{calls.push(args);return {assignment,record:SESSION.create(assignment)}}},CORE,SESSION,CONSENT_VERSION:'consent',snapshot:()=>({}),initializeAssignedUI(){},setStep:s=>state.step=s};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function startStudy('),source.indexOf('function initializeAssignedUI(')),context);await context.startStudy();
 assert.deepEqual(calls,[['lawyer',false]]);assert.equal(state.step,'dossier');assert.equal(state.assignment,assignment);
 context.collection.start=async()=>{throw Error('service unavailable')};state.assignment=null;await context.startStudy();assert.equal(state.step,'intro');assert.equal(state.assignment,null);assert.match(node('#intro-error').textContent,/service unavailable/);
});

test('researcher test reset cannot invalidate formal or pilot progress during central collection',()=>{
 const listeners={},messages=[];
 const context={collectionSettings:{enabled:true},qsa:()=>[],qs:s=>({addEventListener:(event,fn)=>listeners[s+event]=fn}),exportCsv(){},toast:m=>messages.push(m),confirm(){throw Error('A destructive reset must not be offered')}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function bindResearcher(){'),source.indexOf('function openPreview(')),context);context.bindResearcher();listeners['#clear-dataclick']();
 assert.equal(messages.length,1);assert.match(messages[0],/不支持清空/);
});
