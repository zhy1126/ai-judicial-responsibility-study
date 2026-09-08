(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.StudySession=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const VERSION='two-cases-2026-09-08-v1',CASES=['natural','statutory'];
 function create(assignment){
  if(!CASES.includes(assignment.caseType))throw Error('案件分配无效。');
  return {protocol:VERSION,caseOrder:[assignment.caseType,...CASES.filter(x=>x!==assignment.caseType)],caseIndex:0,responses:[],migratedFrom:null};
 }
 function checkAnswer(answer,assignment,caseType){
  if(!answer||answer.caseType!==caseType||['sessionId','role','condition'].some(k=>answer[k]!==assignment[k]))throw Error('案件回答与本次分组不一致。');
 }
 function restore(assignment,draft){
  const fresh=create(assignment),saved=draft.session;
  if(!saved){if(draft.response){checkAnswer(draft.response,assignment,fresh.caseOrder[0]);fresh.responses=[draft.response];fresh.migratedFrom='single_case';}return fresh;}
  if(saved.protocol!==VERSION||!Array.isArray(saved.caseOrder)||saved.caseOrder.join()!==fresh.caseOrder.join()||![0,1].includes(saved.caseIndex)||!Array.isArray(saved.responses)||saved.responses.length<saved.caseIndex||saved.responses.length>saved.caseIndex+1)throw Error('两案进度无法读取。');
  saved.responses.forEach((answer,i)=>checkAnswer(answer,assignment,saved.caseOrder[i]));
  return {...fresh,caseIndex:saved.caseIndex,responses:saved.responses,migratedFrom:saved.migratedFrom||null};
 }
 function complete(session){return session.responses.length===2&&session.responses.every((r,i)=>r.caseType===session.caseOrder[i]);}
 function submit(session,answer,assignment){
  if(session.responses.length!==session.caseIndex)throw Error('本案已提交，请继续下一个案件。');
  checkAnswer(answer,assignment,session.caseOrder[session.caseIndex]);
  return {...session,responses:[...session.responses,answer]};
 }
 function advance(session){
  if(session.caseIndex!==0||session.responses.length!==1)throw Error('请先完成第一个案件。');
  return {...session,caseIndex:1};
 }
 function record(session,assignment,retained=null){
  return {...session,version:'2.1.0',sessionId:assignment.sessionId,assignment,role:assignment.role,condition:assignment.condition,preview:assignment.preview,completed:complete(session),retained,submittedAt:session.responses.at(-1)?.submittedAt||null};
 }
 function rows(records){
  return records.flatMap(record=>record.protocol===VERSION?record.responses.map((r,i)=>({...r,studyProtocol:record.protocol,caseNumber:i+1,caseOrder:record.caseOrder,studyCompleted:record.completed,retained:record.retained,migratedFrom:record.migratedFrom})): [{...record,studyProtocol:'single_case',caseNumber:1,caseOrder:[record.caseType],studyCompleted:false,migratedFrom:null}]);
 }
 return {VERSION,create,restore,submit,advance,complete,record,rows};
});
