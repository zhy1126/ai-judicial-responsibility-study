const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),CORE=require('../study-core.js');
function harness(){
 const nodes={};const node=k=>nodes[k]||=( {value:'',checked:false,disabled:false,textContent:'',classList:{values:new Set(),remove(k){this.values.delete(k)},toggle(k,on){on?this.values.add(k):this.values.delete(k)}}} );
 for(const kind of ['score','allocation'])for(const {id}of CORE.SUBJECTS)node(`#responsibility-${kind}-${id}`);
 const context={CORE,state:{responsibilityStage:'independent'},qs:node,setPendingUI(){},updateSubmitGuidance(){}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function responsibilityInput('),source.indexOf('function ratingApplicable()')),context);
 return {context,node,fill(kind,values){for(const [id,v]of Object.entries(values))node(`#responsibility-${kind}-${id}`).value=String(v);context.updateResponsibilityUI();}};
}
test('both questions remain visible and scores never disappear or populate allocation',()=>{
 const h=harness();h.fill('score',{judge:80,court:60,provider:40,system:20});
 assert.equal(h.node('#responsibility-independent').classList.values.has('hidden'),false);
 assert.equal(h.node('#responsibility-allocation').classList.values.has('hidden'),false);
 assert.equal(h.node('#responsibility-allocation').disabled,false);
 assert.equal(h.context.state.responsibilityStage,'allocation');
 assert.equal(h.node('#responsibility-score-judge').value,'80');
 assert.equal(h.node('#responsibility-allocation-judge').value,'');
});
test('unfinished allocation has an actionable submit button for field-specific guidance',()=>{
 const h=harness();h.fill('score',{judge:80,court:60,provider:40,system:20});
 assert.equal(h.node('#submit-evaluation').disabled,false);
 h.fill('allocation',{judge:60,court:30,provider:9,system:0});
 assert.match(h.node('#allocation-status').textContent,/还差 1 分/);
 assert.equal(h.node('#submit-evaluation').disabled,false);
 h.fill('score',{judge:''});assert.equal(h.node('#responsibility-allocation').disabled,true);
 assert.equal(h.node('#responsibility-allocation-judge').value,'60');
});
test('submission identifies the exact missing score, total, rating or confirmation',()=>{
 assert.ok(source.includes('function surveyIssue('));
 const h=harness();Object.assign(h.context,{RATINGS:[['fairness','裁判形成过程是公正的。']]});
 vm.runInContext(source.slice(source.indexOf('function surveyIssue('),source.indexOf('function setPendingUI()')),h.context);
 h.node('[name="manipulationCheck"]').value='procedural';h.node('[name="finalSigner"]').value='judge';
 assert.match(h.context.surveyIssue().message,/独立评分/);
 h.fill('score',{judge:80,court:60,provider:40,system:20});assert.match(h.context.surveyIssue().message,/责任分配/);
 h.fill('allocation',{judge:60,court:30,provider:9,system:0});assert.match(h.context.surveyIssue().message,/99.*100/);
 h.fill('allocation',{provider:10});assert.equal(h.context.surveyIssue().selector,'[data-rating="perceivedHarm"]');
 h.node('[name="perceivedHarm"]').value='4';assert.equal(h.context.surveyIssue().selector,'[data-rating="fairness"]');
 h.node('[name="fairness"]').value='4';h.node('[name="involvement"]').value='4';
 assert.equal(h.context.surveyIssue().selector,'[name="honestConfirm"]');h.node('[name="honestConfirm"]').checked=true;
 assert.equal(h.context.surveyIssue(),null);
 h.node('#open-response').value='测试';assert.equal(h.context.surveyIssue().selector,'#open-response-confirm');
});
