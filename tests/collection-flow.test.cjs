const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const functions=source.slice(source.indexOf('function setPendingUI()'),source.indexOf('async function submitSurvey(event)'))+'\n'+source.slice(source.indexOf('async function reconcileCentralSession()'),source.indexOf('function prepareProtocol()'));
function harness(){
 const assignment={sessionId:'JR-TEST',role:'lawyer',condition:'procedural',caseType:'natural'},answer={...assignment,caseType:'natural'},control={id:'answer',dataset:{},disabled:false},submit={id:'submit-evaluation',dataset:{},disabled:false},nodes={'#survey-form':{elements:[control,submit]},'#submit-evaluation':submit,'#survey-error':{textContent:''}};
 const SESSION=require('../study-session.js'),StudyCollection=require('../collection-client.js'),state={assignment,session:SESSION.create(assignment),collectionPending:answer};
 const context={state,central:true,SESSION,StudyCollection,qs:k=>nodes[k],collection:{},cacheCentralRecord:r=>context.cached=r,saveDraft:()=>{},initializeAssignedUI:()=>{},setStep:s=>state.step=s,renderCaseProgress:()=>{},toast:m=>context.toastMessage=m,purgeLocalSession:()=>{state.deleted=true;state.collectionPending=null;}};
 vm.createContext(context);vm.runInContext(functions,context);return {context,state,answer,assignment,control,nodes};
}
test('failed submission keeps immutable answer locked; retry stores exactly one case and unlocks',async()=>{
 const h=harness(),seen=[];h.context.collection.submit=async a=>{seen.push(a);throw Error('network')};h.context.setPendingUI();await h.context.retryCentralPending();
 assert.equal(h.control.disabled,true);assert.equal(h.state.collectionPending,h.answer);assert.match(h.nodes['#survey-error'].textContent,/network/);
 h.context.collection.submit=async a=>{seen.push(a);return {response:a,record:{...h.state.session,responses:[a]}}};await h.context.retryCentralPending();
 assert.equal(seen[0],seen[1]);assert.equal(h.state.step,'between');assert.equal(h.state.session.responses.length,1);assert.equal(h.state.collectionPending,null);assert.equal(h.control.disabled,false);
});
test('conflicting second tab restores the authoritative answer instead of endlessly retrying',async()=>{
 const h=harness(),saved={...h.answer,openResponse:'already saved by first tab'};
 h.context.collection.submit=async()=>{throw Object.assign(Error('conflict'),{status:409})};
 h.context.collection.session=async()=>({record:{...h.state.session,sessionId:h.assignment.sessionId,responses:[saved],completed:false}});
 h.context.setPendingUI();await h.context.retryCentralPending();
 assert.equal(h.state.response.openResponse,saved.openResponse);assert.equal(h.state.collectionPending,null);assert.equal(h.state.step,'between');assert.equal(h.control.disabled,false);
});
test('withdrawn response cannot be retried into another answer',async()=>{
 const h=harness();h.context.collection.submit=async()=>{throw Object.assign(Error('withdrawn'),{status:410})};await h.context.retryCentralPending();assert.equal(h.state.deleted,true);assert.equal(h.state.collectionPending,null);
});
