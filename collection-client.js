(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.StudyCollection=api;})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const CONSENT='central-research-2026-09-27-v1';
 function create({baseUrl,storage,key,fetch=globalThis.fetch,crypto=globalThis.crypto,timeoutMs=20000}){
  const base=new URL(baseUrl);if(base.protocol!=='https:'&&base.hostname!=='127.0.0.1')throw Error('数据服务地址无效。');
  function token(){let value=storage.getItem(key);if(!value){value=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');storage.setItem(key,value)}if(!/^[a-f0-9]{64}$/.test(value))throw Error('本次作答凭证无法读取，请联系研究者。');return value}
  async function request(path,method='GET',body){
   const credential=token(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
   try{
    const response=await fetch(new URL('/api/study/'+path,base).href,{method,credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+credential},signal:controller.signal,...(body===undefined?{}:{body:JSON.stringify(body)})});
    let data;try{data=await response.json()}catch{throw Error('数据服务暂不可用，请保持页面并重试。')}
    if(!response.ok)throw Object.assign(Error(data.error||'保存未完成，请重试。'),{status:response.status});return data;
   }catch(e){if(e.status)throw e;throw Error('网络连接未完成，请保留此页并重试。')}finally{clearTimeout(timer)}
  }
  return {start:(backgroundChoice,test)=>request('start','POST',{backgroundChoice,test,consent:{version:CONSENT,accepted:true}}),submit:answer=>request('answer','POST',answer),session:()=>request('session'),withdraw:()=>request('withdraw','POST',{})};
 }
 function pendingForSession(pending,session){
  if(!pending)return null;
  if(session.responses.some(r=>r.caseType===pending.caseType))return null;
  if(pending.caseType!==session.caseOrder[session.caseIndex])throw Error('待确认回答与当前案件不一致，请刷新恢复。');
  return pending;
 }
 return {CONSENT,create,pendingForSession};
});
