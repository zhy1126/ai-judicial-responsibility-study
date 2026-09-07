'use strict';
const STORAGE_KEY = 'judicial_ai_responsibility_prototype_records_v1';
const DRAFT_KEY = 'judicial_ai_responsibility_draft_v2';
const DELETED_KEY = 'judicial_ai_responsibility_deleted_sessions_v2';
const EPOCH_KEY = 'judicial_ai_responsibility_reset_epoch_v2';
const CORE = window.StudyCore;
const CASES = window.StudyContent.cases;
const CONDITIONS = window.StudyContent.conditions;
const LABELS = {
  roles: {lawyer:'律师专业视角',litigant:'当事人视角',public:'公众视角'},
  conditions: {none:'无 AI 对照',procedural:'程序性参与',substantive:'实质性参与',decisional:'决定性参与'},
  cases: {natural:'故意伤害',statutory:'侵犯著作权'},
};
const RATINGS = [
  ['fairness','裁判形成过程是公正的。'], ['control','最终责任大小与各主体的实际控制能力相匹配。'],
  ['clarity','从材料可以清楚判断谁对本案裁判负责。'], ['judgeOwnership','这份裁判体现了法官的独立判断。'],
  ['aiTrust','我愿意信任本案中对 AI 的使用方式。'], ['legitimacy','我认为这份裁判具有正当性。'],
  ['acceptance','如果该裁判对我具有约束力，我愿意遵从。'], ['unease','AI 以这种方式参与使我感到不安。'],
];
const STEPS = ['intro','dossier','replay','decision','survey','debrief'];
const qs = (selector,root=document)=>root.querySelector(selector);
const qsa = (selector,root=document)=>[...root.querySelectorAll(selector)];
const state = {preview:false,role:'public',condition:'procedural',caseType:'natural',assignment:null,step:'intro',ranking:[],rankingInitial:[],readTabs:[],formValues:{},replayExposureMs:0,replayEnteredAt:null,response:null,deleted:false,audio:{status:'not_supplied',started:false,completed:false,maxPositionSeconds:0},speechMetadata:null};
let speech, toastTimer, draftBlocked=false, speechChanged=false;
let storageEpoch='';
try{storageEpoch=localStorage.getItem(EPOCH_KEY)||'';}catch{}
const params = new URLSearchParams(location.search);
state.preview=params.get('preview')==='1';
if(state.preview){
  state.role=valid(params.get('role'),CORE.ROLES,'public');
  state.condition=valid(params.get('condition'),CORE.CONDITIONS,'procedural');
  state.caseType=valid(params.get('case'),CORE.CASE_TYPES,'natural');
}
const previewSelection={role:state.role,condition:state.condition,caseType:state.caseType};
const draftKey=state.preview?`${DRAFT_KEY}_preview_${state.role}_${state.condition}_${state.caseType}`:DRAFT_KEY;
init();

function init(){
  const view=params.get('view')==='participant'?'participant':'researcher';
  qs(`#${view}-view`).classList.remove('hidden');
  bindResearcher(); renderRecords();
  if(view==='participant')setupParticipant();
}
function bindResearcher(){
  qsa('[data-scroll]').forEach(button=>button.addEventListener('click',()=>{
    qsa('[data-scroll]').forEach(item=>item.classList.remove('active'));button.classList.add('active');
    qs(`#${button.dataset.scroll}`)?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  qsa('.segmented button').forEach(button=>button.addEventListener('click',()=>{
    qsa('.segmented button').forEach(item=>item.classList.remove('selected'));button.classList.add('selected');
  }));
  qs('#quick-preview').addEventListener('click',()=>openPreview('public','procedural','natural'));
  qs('#preview-config').addEventListener('submit',event=>{
    event.preventDefault();const data=new FormData(event.currentTarget);
    openPreview(qs('.segmented button.selected')?.dataset.value||'public',data.get('preview-condition'),data.get('preview-case'));
  });
  qs('#export-csv').addEventListener('click',exportCsv);
  qs('#clear-data').addEventListener('click',()=>{
    if(!confirm('确定清空当前浏览器中的全部测试记录和未完成进度吗？此操作无法撤销。'))return;
    try{
      localStorage.setItem(EPOCH_KEY,`${Date.now()}-${token(8)}`);storageEpoch=localStorage.getItem(EPOCH_KEY);
      localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(DRAFT_KEY);localStorage.removeItem(DELETED_KEY);
      Object.keys(sessionStorage).filter(k=>k.startsWith(DRAFT_KEY+'_preview_')).forEach(k=>sessionStorage.removeItem(k));
      renderRecords();toast('测试记录和进度已清空');
    }catch{toast('未能清空，请检查浏览器存储权限。');}
  });
}
function openPreview(role,condition,caseType){
  const url=new URL(location.href);url.search='';
  for(const [k,v] of Object.entries({view:'participant',preview:'1',role,condition,case:caseType}))url.searchParams.set(k,v);
  window.open(url.toString(),'_blank','noopener');
}
function draftStorage(){return state.preview?sessionStorage:localStorage;}
function setupParticipant(){
  if(state.preview){
    qs('#preview-banner').classList.remove('hidden');qs('#researcher-return').classList.remove('hidden');qs('#finish-link').classList.remove('hidden');
    qs('#preview-condition-label').textContent=`${LABELS.roles[state.role]} · ${LABELS.conditions[state.condition]} · ${LABELS.cases[state.caseType]}`;
    for(const [name,value] of Object.entries({practicingLawyer:state.role==='lawyer'?'yes':'no',licenseActive:state.role==='lawyer'?'yes':'no',legalEducation:state.role==='lawyer'?'yes':'no',litigationExperience:state.role==='litigant'?'yes':'no'}))qs(`input[name="${name}"][value="${value}"]`).checked=true;
    qs('#screening-note').textContent='预览使用示例背景，按设计台选定的视角和条件呈现，不代表真实参与者。';
  }
  qsa('input[name="practicingLawyer"],input[name="licenseActive"]').forEach(el=>el.addEventListener('change',updateScreening));updateScreening();
  qs('#start-study').addEventListener('click',startStudy);
  qsa('.dossier-tabs button').forEach(button=>button.addEventListener('click',()=>showDossierTab(button.dataset.tab)));
  qs('#to-replay').addEventListener('click',beginReplay);
  qs('#to-decision').addEventListener('click',()=>{
    if(!qs('#transcript-confirm').checked){qs('#transcript-error').textContent='请确认已阅读完整裁判说明。';return;}
    renderDecision();setStep('decision');
  });
  qs('#to-survey').addEventListener('click',()=>setStep('survey'));
  qsa('[data-back]').forEach(button=>button.addEventListener('click',()=>setStep(button.dataset.back)));
  qs('#ranking-mode').addEventListener('change',updateRankingMode);
  qs('#survey-form').addEventListener('submit',submitSurvey);
  qs('#survey-form').addEventListener('input',()=>{captureForm();saveDraft();updateRatingFeedback();});
  qs('#survey-form').addEventListener('change',()=>{captureForm();saveDraft();updateRatingFeedback();});
  qs('#dossier-confirm').addEventListener('change',()=>saveDraft());
  qs('#transcript-confirm').addEventListener('change',()=>saveDraft());
  qs('#delete-response').addEventListener('click',deleteResponse);
  qs('#retain-response').addEventListener('click',retainResponse);
  qs('#download-response').addEventListener('click',downloadResponse);
  speech=window.StudySpeech.create({textarea:qs('#open-response'),startButton:qs('#speech-start'),stopButton:qs('#speech-stop'),status:qs('#speech-status'),interim:qs('#speech-interim'),onChange:()=>{
    speechChanged=true;qs('#open-response-confirm').checked=false;updateOpenResponse();captureForm();saveDraft();
  }});
  const audio=qs('#judgment-audio');
  audio.addEventListener('play',()=>{state.audio.started=true;state.audio.status='available';saveDraft();});
  audio.addEventListener('timeupdate',()=>{state.audio.maxPositionSeconds=Math.max(state.audio.maxPositionSeconds||0,audio.currentTime||0);});
  audio.addEventListener('ended',()=>{state.audio.completed=true;saveDraft();});
  audio.addEventListener('error',()=>{state.audio.status='error';audio.classList.add('hidden');qs('#audio-status').textContent='录音暂时无法播放。完整文字仍可阅读，您可以继续作答。';saveDraft();});
  window.addEventListener('pagehide',()=>{stopExposure();captureForm();saveDraft();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopExposure();else if(state.step==='replay')state.replayEnteredAt=Date.now();saveDraft();});
  restoreDraft();
}
function updateScreening(){
  const practicing=qs('input[name="practicingLawyer"]:checked')?.value==='yes';
  qs('#license-question').classList.toggle('hidden',!practicing);
  qsa('input[name="licenseActive"]').forEach(el=>el.disabled=!practicing);
  if(!state.preview)qs('#screening-note').textContent=practicing&&qs('input[name="licenseActive"]:checked')?.value==='no'?'请核对您的回答：当前未有效执业时，后续将分配模拟观察视角。':'';
}
function startStudy(){
  qs('#intro-error').textContent='';
  if(draftBlocked){qs('#intro-error').textContent='已有进度无法读取，请联系研究者处理后再继续。';return;}
  if(!qs('#consent-checkbox').checked){qs('#intro-error').textContent='请先确认同意参加。';return;}
  const background=Object.fromEntries(['practicingLawyer','licenseActive','legalEducation','litigationExperience'].map(name=>[name,qs(`input[name="${name}"]:checked`)?.value||null]));
  try{
    if(!currentEpoch()){qs('#intro-error').textContent='研究者已清空测试数据，请刷新页面后开始新的体验。';return;}
    // Re-read before assigning so another tab's existing assignment is not rerandomized.
    const raw=draftStorage().getItem(draftKey);
    const prior=raw?JSON.parse(raw):null;
    const existing=prior?.epoch===storageEpoch?prior.assignment:state.assignment;
    state.assignment=CORE.assignParticipant(background,{existing,sessionId:`JR-${token(8).toUpperCase()}`,preview:state.preview?previewSelection:null});
    Object.assign(state,{role:state.assignment.role,condition:state.assignment.condition,caseType:state.assignment.caseType});
    if(raw&&CORE.validAssignment(existing)){restoreDraft();return;}
    state.ranking=CORE.shuffle(CORE.subjectsFor(state.condition).map(x=>x.id));state.rankingInitial=[...state.ranking];
    state.step='dossier';
    draftStorage().setItem(draftKey,JSON.stringify(snapshot()));
    initializeAssignedUI();setStep('dossier');
  }catch(error){state.step='intro';qs('#intro-error').textContent=error.message==='请完成所有背景是非题。'?error.message:'无法保存本次分组，请允许浏览器保存本机数据后再试。';}
}
function initializeAssignedUI(){
  qs('#session-code').textContent=`体验编号：${state.assignment.sessionId}`;
  qs('#role-perspective').textContent={lawyer:'请结合您的律师专业经验评价以下裁判过程。',litigant:'本次请采用模拟的诉讼当事人视角：设想您是受到这份裁判影响的当事人。此视角不表示您的真实经历。',public:'本次请采用普通公众的观察视角：作为关注司法活动的社会成员，评价以下裁判过程。'}[state.role];
  renderDossier();renderTranscript();renderDecision();renderRanking();renderRatings();restoreForm();updateRankingMode();updateOpenResponse();
}
function restoreDraft(){
  try{
    const raw=draftStorage().getItem(draftKey);if(!raw)return;
    const draft=JSON.parse(raw);
    if(draft.epoch!==storageEpoch){draftStorage().removeItem(draftKey);return;}
    if(draft.deleted||isDeleted(draft.assignment?.sessionId)){draftStorage().setItem(draftKey,JSON.stringify(deletionMarker(draft.sessionId||draft.assignment.sessionId)));state.deleted=true;state.response=null;state.formValues={};qs('#session-code').textContent='本次回答已删除';markDeleted();setStep('debrief',false);return;}
    if(draft.version!==CORE.VERSION||!CORE.validAssignment(draft.assignment)||!STEPS.includes(draft.step))throw Error('invalid draft');
    Object.assign(state,{assignment:draft.assignment,role:draft.assignment.role,condition:draft.assignment.condition,caseType:draft.assignment.caseType,step:draft.step,ranking:draft.ranking,rankingInitial:draft.rankingInitial,readTabs:draft.readTabs||[],formValues:draft.formValues||{},replayExposureMs:draft.replayExposureMs||0,response:draft.response||null,deleted:Boolean(draft.deleted),audio:draft.audio||state.audio,speechMetadata:draft.speechMetadata||null});
    if(state.deleted)state.ranking=CORE.subjectsFor(state.condition).map(x=>x.id);
    else if(!CORE.validRanking(state.ranking,state.condition))throw Error('invalid ranking');
    initializeAssignedUI();qs('#dossier-confirm').checked=Boolean(draft.dossierConfirmed);qs('#transcript-confirm').checked=Boolean(draft.transcriptConfirmed);
    if(state.deleted)markDeleted();setStep(state.step,false);
  }catch{draftBlocked=true;qs('#intro-error').textContent='已有进度无法读取，请联系研究者处理后再继续。';}
}
function exposure(){return state.replayExposureMs+(state.replayEnteredAt?Math.max(0,Date.now()-state.replayEnteredAt):0);}
function stopExposure(){state.replayExposureMs=exposure();state.replayEnteredAt=null;}
function mergedSpeechMetadata(){
  const now=speech?.getMetadata();const old=state.speechMetadata;
  if(!old)return now||null;if(!now||(!speechChanged&&now.attempts===0))return old;
  const inputMethod=old.inputMethod===now.inputMethod?old.inputMethod:(old.inputMethod==='text'&&now.attempts===0&&!(qs('#open-response')?.value))?old.inputMethod:'mixed';
  return {...now,inputMethod,attempts:(old.attempts||0)+(now.attempts||0),errors:[...(old.errors||[]),...(now.errors||[])]};
}
function deletionMarker(sessionId){return {version:CORE.VERSION,epoch:storageEpoch,sessionId,step:'debrief',deleted:true};}
function deletedSessions(){const raw=localStorage.getItem(DELETED_KEY);const ids=raw?JSON.parse(raw):[];if(!Array.isArray(ids))throw Error('删除状态无法读取。');return ids;}
function isDeleted(id){return Boolean(id&&deletedSessions().includes(id));}
function currentEpoch(){return (localStorage.getItem(EPOCH_KEY)||'')===storageEpoch;}
function snapshot(){if(state.deleted)return deletionMarker(state.assignment?.sessionId);return {epoch:storageEpoch,version:CORE.VERSION,assignment:state.assignment,step:state.step,ranking:state.ranking,rankingInitial:state.rankingInitial,readTabs:state.readTabs,formValues:state.formValues,replayExposureMs:exposure(),dossierConfirmed:qs('#dossier-confirm').checked,transcriptConfirmed:qs('#transcript-confirm').checked,response:state.response,deleted:state.deleted,audio:state.audio,speechMetadata:mergedSpeechMetadata()};}
function saveDraft(){
  if(!state.assignment||draftBlocked)return;
  try{
    if(!currentEpoch())return;
    if(isDeleted(state.assignment.sessionId)){draftStorage().setItem(draftKey,JSON.stringify(deletionMarker(state.assignment.sessionId)));return;}
    draftStorage().setItem(draftKey,JSON.stringify(snapshot()));
  }
  catch{toast('进度暂未保存。请保持页面打开，并检查浏览器存储权限。');}
}
function captureForm(){
  state.formValues=Object.fromEntries([...qs('#survey-form').elements].filter(el=>el.name&&(el.type!=='radio'||el.checked)).map(el=>[el.name,el.type==='checkbox'?el.checked:el.value]));
}
function restoreForm(){
  for(const el of qs('#survey-form').elements){if(!el.name||!(el.name in state.formValues))continue;
    if(el.type==='checkbox')el.checked=Boolean(state.formValues[el.name]);
    else if(el.type==='radio')el.checked=el.value===state.formValues[el.name];
    else el.value=state.formValues[el.name];
  }updateRatingFeedback();
}
function renderDossier(){qs('#case-category-badge').textContent=CASES[state.caseType].category;showDossierTab('overview',false);}
function showDossierTab(tab,persist=true){
  if(!['overview','evidence','task'].includes(tab))return;
  if(!state.readTabs.includes(tab))state.readTabs.push(tab);
  qsa('.dossier-tabs button').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.tab===tab)));
  const data=CASES[state.caseType];
  if(tab==='overview')qs('#dossier-content').innerHTML=`<div class="dossier-title"><div><h2>${data.category}</h2><p>${data.number}</p></div><span class="dossier-tag">${data.tag}</span></div><div class="fact-grid">${data.overview.facts.map(([k,v])=>`<div class="fact-box"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div><p class="dossier-summary">${data.overview.summary}</p>`;
  else if(tab==='evidence')qs('#dossier-content').innerHTML=`<div class="dossier-title"><div><h2>材料与证据摘要</h2><p>${data.evidenceNote}</p></div></div><div class="evidence-list">${data.evidence.map(([id,title,detail,status])=>`<div class="evidence-item"><span>${id}</span><div><strong>${title}</strong><small>${detail}</small></div><em class="evidence-status">${status}</em></div>`).join('')}</div>`;
  else qs('#dossier-content').innerHTML=`<div class="dossier-title"><div><h2>裁判任务</h2><p>请理解裁判需要回应的问题</p></div></div><div class="task-prompt"><p>${data.task}</p></div><div class="issue-list">${data.issues.map((issue,index)=>`<div><span>0${index+1}</span><p>${issue}</p></div>`).join('')}</div>`;
  if(persist)saveDraft();
}
function beginReplay(){
  if(!qs('#dossier-confirm').checked||state.readTabs.length<3){qs('#dossier-error').textContent='请依次阅读三个案卷栏目，并确认已阅读。';return;}
  qs('#dossier-error').textContent='';setStep('replay');
}
function renderTranscript(){
  const data=CASES[state.caseType],condition=CONDITIONS[state.condition];
  qs('#process-description').textContent=condition.intro;
  qs('#judgment-transcript').innerHTML=data.narrative.map(p=>`<p>${escapeHtml(p)}</p>`).join('');
  qs('#review-description').textContent=condition.review;
  const audio=qs('#judgment-audio'),source=window.STUDY_AUDIO?.[state.caseType]?.[state.condition];
  const completeAudio=CORE.CASE_TYPES.every(k=>CORE.CONDITIONS.every(c=>{try{const value=window.STUDY_AUDIO?.[k]?.[c];return Boolean(value)&&new URL(value,location.href).origin===location.origin;}catch{return false;}}));
  if(source&&completeAudio){
    const url=new URL(source,location.href);
    if(url.origin===location.origin){audio.src=url.href;audio.classList.remove('hidden');state.audio.status=state.audio.status==='error'?'configured':state.audio.status==='not_supplied'?'configured':state.audio.status;qs('#audio-status').textContent='可收听、暂停或重播；下方为同一份完整文字。';return;}
  }
  audio.removeAttribute('src');audio.classList.add('hidden');state.audio.status='not_supplied';
  qs('#audio-status').textContent='本案例暂未提供录音，您可以阅读全文继续。';
}
function renderDecision(){
  const data=CASES[state.caseType];qs('#judgment-case-number').textContent=data.number;qs('#judgment-court').textContent=data.court;
  qs('#judgment-content').innerHTML=`<h2>刑事裁判摘要（研究材料）</h2>${data.judgment.map(p=>`<p>${p}</p>`).join('')}<ol>${data.orders.map(p=>`<li>${p}</li>`).join('')}</ol>`;
  qs('#decision-modification').textContent=CONDITIONS[state.condition].modification;
}
function renderRanking(){
  qs('#ranking-list').innerHTML=state.ranking.map((id,index)=>{const subject=CORE.SUBJECTS.find(x=>x.id===id);return `<div class="ranking-item"><span class="rank-number">${index+1}</span><div><strong>${subject.label}</strong><p>${subject.description}</p></div><div class="rank-actions"><button type="button" data-rank-up="${index}" ${index===0?'disabled':''} aria-label="将${subject.label}上移">↑</button><button type="button" data-rank-down="${index}" ${index===state.ranking.length-1?'disabled':''} aria-label="将${subject.label}下移">↓</button></div></div>`;}).join('');
  qsa('[data-rank-up]').forEach(button=>button.addEventListener('click',()=>moveRank(Number(button.dataset.rankUp),-1)));
  qsa('[data-rank-down]').forEach(button=>button.addEventListener('click',()=>moveRank(Number(button.dataset.rankDown),1)));
}
function moveRank(index,direction){
  const target=index+direction;if(target<0||target>=state.ranking.length)return;
  [state.ranking[index],state.ranking[target]]=[state.ranking[target],state.ranking[index]];
  qs('#ranking-confirm').checked=false;renderRanking();captureForm();saveDraft();
  qs(direction===-1?`[data-rank-down="${target}"]`:`[data-rank-up="${target}"]`)?.focus();
}
function updateRankingMode(){
  const ranking=qs('#ranking-mode').value==='rank';qs('#ranking-section').classList.toggle('hidden',!ranking);qs('#ranking-confirm').required=ranking;
}
function ratingApplicable(name){return !(state.condition==='none'&&['aiTrust','unease'].includes(name));}
function renderRatings(){
  qs('#rating-list').innerHTML=RATINGS.map(([name,label])=>`<fieldset class="likert-question" data-rating="${name}"><legend>${label}</legend>${ratingApplicable(name)?`<div class="likert-options">${CORE.SCALE.map((text,i)=>`<label><input type="radio" name="${name}" value="${i+1}" required><span class="likert-score">${i+1}</span><span>${text}</span></label>`).join('')}</div><label class="unsure-option"><input type="radio" name="${name}" value="unsure" required>无法判断</label><p class="rating-feedback" role="status">尚未选择</p>`:'<p class="not-applicable">本情境未使用 AI，此题不适用。</p>'}</fieldset>`).join('');
}
function updateRatingFeedback(){
  for(const [name]of RATINGS){const field=qs(`[data-rating="${name}"]`),feedback=qs('.rating-feedback',field);if(!feedback)continue;
    const value=qs('input:checked',field)?.value;feedback.textContent=!value?'尚未选择':value==='unsure'?'您选择了：无法判断':`您选择了：${value} 分，${CORE.SCALE[Number(value)-1]}`;
  }
}
function updateOpenResponse(){const hasText=qs('#open-response').value.trim().length>0;qs('#char-count').textContent=qs('#open-response').value.length;qs('#open-response-confirm-row').classList.toggle('hidden',!hasText);qs('#open-response-confirm').required=hasText;}
function submitSurvey(event){
  event.preventDefault();qs('#survey-error').textContent='';
  if(speech.isBusy()){qs('#survey-error').textContent='请先停止语音输入，等待识别结束并核对文字后提交。';return;}
  if(state.response||state.deleted)return;
  const form=event.currentTarget;if(!form.reportValidity()){qs('#survey-error').textContent='请完成所有必答题和确认项。';return;}
  try{
    const data=new FormData(form),ratings={},ratingStatus={};
    for(const [name]of RATINGS){const result=CORE.ratingValue(data.get(name),ratingApplicable(name));ratings[name]=result.value;ratingStatus[name]=result.status;}
    const rankingMode=data.get('rankingMode');
    if(rankingMode==='rank'&&!CORE.validRanking(state.ranking,state.condition))throw Error('排序无法保存，请联系研究者。');
    stopExposure();captureForm();
    const response={version:CORE.VERSION,caseVersion:window.StudyContent.version,sessionId:state.assignment.sessionId,role:state.role,background:state.assignment.background,roleAssignment:state.assignment.roleAssignment,condition:state.condition,caseType:state.caseType,preview:state.preview,assignment:state.assignment,replayCompleted:qs('#transcript-confirm').checked,replayExposureMs:state.replayExposureMs,presentation:'static_transcript_optional_audio',audio:{...state.audio},manipulationCheck:data.get('manipulationCheck'),finalSigner:data.get('finalSigner'),rankingStatus:rankingMode,ranking:rankingMode==='rank'?state.ranking.map(id=>CORE.SUBJECTS.find(s=>s.id===id).label):[],rankingIds:rankingMode==='rank'?[...state.ranking]:[],rankingInitial:[...state.rankingInitial],ratings,ratingStatus,openResponse:String(data.get('openResponse')||''),speech:mergedSpeechMetadata(),retained:null,submittedAt:new Date().toISOString(),prototype:true};
    updateSavedResponse(response);state.response=response;setStep('debrief');
  }catch(error){qs('#survey-error').textContent=`未提交：${error.message}`;}
}
function retainResponse(){
  if(!state.response||state.deleted)return;
  try{const updated={...state.response,retained:true};updateSavedResponse(updated);state.response=updated;saveDraft();qs('#retain-status').textContent='已记录：同意匿名保留本次回答。';}
  catch{qs('#retain-status').textContent='未能保存选择，请重试。';}
}
function markDeleted(){
  qs('#retain-status').textContent='本次回答和未完成内容已从当前浏览器删除。';
  qs('#retain-response').disabled=true;qs('#delete-response').disabled=true;qs('#download-response').disabled=true;
}
function deleteResponse(){
  if(!state.response||state.deleted)return;
  try{
    if(!currentEpoch())throw Error('测试数据已经清空。');
    const sessionId=state.response.sessionId;
    const ids=deletedSessions();if(!ids.includes(sessionId))ids.push(sessionId);localStorage.setItem(DELETED_KEY,JSON.stringify(ids));
    const records=readRecords().filter(x=>x.sessionId!==sessionId);localStorage.setItem(STORAGE_KEY,JSON.stringify(records));
    // Keep only assignment and completion marker to prevent refresh from resurrecting deleted answers.
    state.response=null;state.formValues={};state.speechMetadata=null;state.deleted=true;
    qs('#survey-form').reset();speech.destroy();qs('#open-response').value='';
    draftStorage().removeItem(draftKey);state.step='debrief';saveDraft();markDeleted();
  }catch{qs('#retain-status').textContent='删除未完成，请重试。';}
}
function downloadResponse(){if(!state.response||state.deleted)return;try{if(!currentEpoch()||isDeleted(state.response.sessionId)){qs('#retain-status').textContent='本次数据已被删除或清空，不能下载。';return;}downloadBlob(JSON.stringify(state.response,null,2),`${state.response.sessionId}.json`,'application/json');}catch{qs('#retain-status').textContent='无法确认数据状态，请刷新页面后重试。';}}
function setStep(step,persist=true){
  if(!STEPS.includes(step))return;
  if(state.step==='replay')stopExposure();
  if(step!=='replay')qs('#judgment-audio').pause();
  if(step!=='survey'&&speech?.isBusy())speech.stop();
  state.step=step;if(step==='replay'&&!document.hidden)state.replayEnteredAt=Date.now();
  qsa('.study-screen').forEach(screen=>screen.classList.toggle('active',screen.id===`screen-${step}`));
  const current=STEPS.indexOf(step);qsa('.study-progress li').forEach((item,i)=>{item.classList.toggle('active',i===current);item.classList.toggle('done',i<current);});
  window.scrollTo({top:0,behavior:'instant'});if(persist)saveDraft();
}
function readRecords(){const raw=localStorage.getItem(STORAGE_KEY);const records=raw?JSON.parse(raw):[];if(!Array.isArray(records))throw Error('已有记录无法读取，不能覆盖。');return records;}
function updateSavedResponse(response){if(!currentEpoch()||isDeleted(response.sessionId))throw Error('本次数据已被删除或清空，不能再次保存。');const records=readRecords();const index=records.findIndex(x=>x.sessionId===response.sessionId);if(index<0)records.push(response);else records[index]=response;localStorage.setItem(STORAGE_KEY,JSON.stringify(records));}
function renderRecords(){
  let records;try{records=readRecords();}catch{qs('#records-body').innerHTML='<tr><td colspan="6">已有记录无法读取，未作覆盖。请联系研究者处理。</td></tr>';return;}
  const numeric=records.filter(x=>typeof x.ratings?.fairness==='number');const ranked=records.filter(x=>x.ranking?.length);
  qs('#metric-complete').textContent=records.length;
  qs('#metric-fairness').textContent=numeric.length?(numeric.reduce((sum,x)=>sum+x.ratings.fairness,0)/numeric.length).toFixed(1):'—';
  qs('#metric-judge-first').textContent=ranked.length?`${Math.round(ranked.filter(x=>x.rankingIds?.[0]==='judge'||x.ranking?.[0]==='本案承办法官').length/ranked.length*100)}%`:'—';
  qs('#metric-latest').textContent=records.length?formatTime(records.at(-1).submittedAt):'—';
  qs('#records-body').innerHTML=records.length?records.slice().reverse().map(item=>`<tr><td>${escapeHtml(item.sessionId)}</td><td>${escapeHtml(LABELS.roles[item.role]||item.role)}<small>v${escapeHtml(item.version||'1')} ${item.preview?'预览':''}</small></td><td>${escapeHtml(LABELS.conditions[item.condition]||item.condition)}</td><td>${escapeHtml(item.version?LABELS.cases[item.caseType]:item.caseType==='natural'?'旧版故意伤害':'旧版数据处置')}</td><td>${escapeHtml(item.ratings?.fairness??'—')}</td><td>${formatTime(item.submittedAt)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty-cell">尚无测试记录。完成参与者流程后可在这里查看与导出。</td></tr>';
}
function exportCsv(){
  let records;try{records=readRecords();}catch{return toast('已有记录无法读取，未作覆盖。');}if(!records.length)return toast('当前没有可导出的记录');
  const header=['session_id','version','case_version','preview','role','role_assignment','practicing_lawyer','license_active','legal_education','litigation_experience','condition','case_type','replay_completed','replay_exposure_ms','ranking_status','ranking_ids','ranking_labels','ranking_initial',...RATINGS.flatMap(([k])=>[k,k+'_status']),'manipulation_check','final_signer','open_response','speech_metadata','audio_metadata','retained','submitted_at'];
  const rows=records.map(r=>[r.sessionId,r.version||'1',r.caseVersion||'legacy',r.preview,r.role,r.roleAssignment||'self_selected',r.background?.practicingLawyer,r.background?.licenseActive,r.background?.legalEducation,r.background?.litigationExperience,r.condition,r.caseType,r.replayCompleted,r.replayExposureMs,r.rankingStatus||'legacy',JSON.stringify(r.rankingIds||[]),JSON.stringify(r.ranking||[]),JSON.stringify(r.rankingInitial||[]),...RATINGS.flatMap(([k])=>[r.ratings?.[k],r.ratingStatus?.[k]||'legacy']),r.manipulationCheck,r.finalSigner,r.openResponse,JSON.stringify(r.speech||null),JSON.stringify(r.audio||null),r.retained,r.submittedAt]);
  downloadBlob([header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n'),'judicial-ai-prototype.csv','text/csv;charset=utf-8');
}
function valid(value,choices,fallback){return choices.includes(value)?value:fallback;}
function token(length){const chars='abcdefghjkmnpqrstuvwxyz23456789';return Array.from({length},()=>CORE.choose([...chars])).join('');}
function formatTime(value){const date=new Date(value);return value&&!Number.isNaN(date.valueOf())?new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date):'—';}
function csvCell(value){let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`;}
function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function downloadBlob(content,filename,type){const blob=new Blob(type.startsWith('text/csv')?['\ufeff',content]:[content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function toast(message){clearTimeout(toastTimer);qs('#toast').textContent=message;qs('#toast').classList.remove('hidden');toastTimer=setTimeout(()=>qs('#toast').classList.add('hidden'),3500);}
