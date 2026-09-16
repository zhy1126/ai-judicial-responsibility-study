'use strict';
const STORAGE_KEY = 'judicial_ai_responsibility_prototype_records_v1';
const DRAFT_KEY = 'judicial_ai_responsibility_draft_v2';
const DELETED_KEY = 'judicial_ai_responsibility_deleted_sessions_v2';
const EPOCH_KEY = 'judicial_ai_responsibility_reset_epoch_v2';
const PROTOCOL_KEY = 'judicial_ai_responsibility_protocol_v1';
const CORE = window.StudyCore;
const CASES = window.StudyContent.cases;
const NARRATION = window.StudyNarration;
const CONSENT_VERSION = "research-use-2026-09-16";
const PRESENTATION_PROTOCOL = "legal-industry-screening-2026-09-16-v2";
const SESSION = window.StudySession;
const LABELS = {
  roles: {judge:'法官专业视角',lawyer:'律师专业视角',litigant:'当事人视角',public:'公众视角'},
  conditions: {none:'无 AI 对照',procedural:'程序性参与',substantive:'实质性参与',decisional:'决定性参与'},
  cases: {natural:'故意伤害',statutory:'侵犯著作权'},
};
const RATINGS = [
  ['fairness','裁判形成过程是公正的。'], ['control','最终责任大小与各主体的实际控制能力相匹配。'],
  ['clarity','从材料可以清楚判断谁对本案裁判负责。'], ['judgeOwnership','这份裁判体现了法官的独立判断。'],
  ['aiTrust','我愿意信任本案对是否使用 AI 及如何使用 AI 的安排。'], ['legitimacy','我认为这份裁判具有正当性。'],
  ['acceptance','如果该裁判对我具有约束力，我愿意遵从。'], ['unease','本案关于 AI 使用的安排使我感到不安。'],
];
const STEPS = ['intro','dossier','replay','decision','survey','debrief','between'];
const qs = (selector,root=document)=>root.querySelector(selector);
const qsa = (selector,root=document)=>[...root.querySelectorAll(selector)];
const state = {preview:false,role:'public',condition:'procedural',caseType:'natural',assignment:null,session:null,retained:null,step:'intro',responsibilityOrder:[],responsibilityStage:'independent',reading:{},activeDossierTab:"overview",formValues:{},replayExposureMs:0,replayEnteredAt:null,response:null,deleted:false,audio:{status:'not_supplied',started:false,completed:false,maxPositionSeconds:0},speechMetadata:null,replay:{mode:null,stream:null,completed:false}};
let initializingUI=false,pendingAudioPosition=null,exposureTick=performance.now(),lastExposureSave=0;
let speech, toastTimer, draftBlocked=false, speechChanged=false;
let storageEpoch='';
try{storageEpoch=localStorage.getItem(EPOCH_KEY)||'';}catch{}
state.orientation={};state.consent=null;
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
  prepareProtocol();
  const view=params.get('view')==='participant'?'participant':'researcher';
  qs(`#${view}-view`).classList.remove('hidden');
  bindResearcher(); renderRecords();
  if(view==='participant')setupParticipant();
}
function prepareProtocol(){
  try{
    let marker=JSON.parse(localStorage.getItem(PROTOCOL_KEY)||'null');
    if(marker?.protocol===PRESENTATION_PROTOCOL&&marker.phase==='complete')return;
    if(marker?.protocol!==PRESENTATION_PROTOCOL||![marker.fromEpoch,marker.toEpoch].includes(storageEpoch)){
      marker={protocol:PRESENTATION_PROTOCOL,fromEpoch:storageEpoch,toEpoch:`${PRESENTATION_PROTOCOL}-${token(8)}`,phase:'pending'};
      localStorage.setItem(PROTOCOL_KEY,JSON.stringify(marker));
    }
    // Journal the migration before any writes, so a failed write can resume on refresh.
    const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
    if(draft?.epoch===marker.fromEpoch){draft.epoch=marker.toEpoch;localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));}
    // Retire already-open single-case writers after preserving their saved work.
    localStorage.setItem(EPOCH_KEY,marker.toEpoch);storageEpoch=marker.toEpoch;
    localStorage.setItem(PROTOCOL_KEY,JSON.stringify({...marker,phase:'complete'}));
  }catch{draftBlocked=true;qs('#intro-error').textContent='流程升级暂未保存，原进度仍保留。请检查浏览器存储空间后刷新重试。';}
}
function newerDraftExists(){
  const saved=JSON.parse(draftStorage().getItem(draftKey)||'null');
  return saved?.epoch===storageEpoch&&saved.assignment?.sessionId===state.assignment?.sessionId&&saved.session?.protocol===SESSION.VERSION&&state.session&&(saved.session.caseIndex>state.session.caseIndex||saved.session.responses.length>state.session.responses.length);
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
    for(const [name,value] of Object.entries({legalIndustry:['lawyer','judge'].includes(state.role)?'yes':'no',legalOccupation:state.role==='lawyer'?'lawyer':'judge',judgeCaseExperience:state.role==='judge'?'yes':'no',legalDegree:['lawyer','judge'].includes(state.role)?'yes':'no',litigationExperience:state.role==='litigant'?'yes':'no'}))qs(`input[name="${name}"][value="${value}"]`).checked=true;
    qs('#screening-note').textContent='预览使用示例背景，按设计台选定的视角和条件呈现，不代表真实参与者。';
  }
  qsa('.screening-section input[type="radio"]').forEach(el=>el.addEventListener('change',updateScreening));updateScreening();
  qs('#start-study').addEventListener('click',startStudy);
  qsa('.dossier-tabs button').forEach(button=>button.addEventListener('click',()=>showDossierTab(button.dataset.tab)));
  qs('#to-replay').addEventListener('click',beginReplay);
  qs('#to-decision').addEventListener('click',()=>{
    if(!state.replay.completed||!qs('#transcript-confirm').checked){qs('#transcript-error').textContent='请完整播放裁判过程，并勾选确认。';return;}
    renderDecision();setStep('decision');
  });
  qs('#to-survey').addEventListener('click',()=>setStep('survey'));
  qsa('[data-back]').forEach(button=>button.addEventListener('click',()=>setStep(button.dataset.back)));
  qs('#survey-form').addEventListener('submit',submitSurvey);
  qs('#to-allocation').addEventListener('click',()=>changeResponsibilityStage('allocation'));
  qs('#back-to-scores').addEventListener('click',()=>changeResponsibilityStage('independent'));
  qs('#survey-form').addEventListener('input',()=>{updateResponsibilityUI();captureForm();saveDraft();updateRatingFeedback();});
  qs('#survey-form').addEventListener('change',()=>{updateResponsibilityUI();captureForm();saveDraft();updateRatingFeedback();});
  qs('#dossier-confirm').addEventListener('change',()=>{
    const progress=state.reading[state.activeDossierTab];
    if(progress?.reachedEnd&&progress.visibleMs>=CORE.MIN_READING_MS)progress.confirmed=qs('#dossier-confirm').checked;
    updateReadingUI();saveDraft();
  });
  qs('#dossier-content').addEventListener('scroll',checkReadingEnd);
  window.addEventListener('resize',checkReadingEnd);
  qs('#transcript-confirm').addEventListener('change',()=>{updatePlaybackGate();saveDraft();});
  qs('#playback-toggle').addEventListener('click',togglePlayback);
  qs('#playback-restart').addEventListener('click',restartPlayback);
  qs('#delete-response').addEventListener('click',deleteResponse);
  qs('#download-response').addEventListener('click',downloadResponse);
  qs('#next-case').addEventListener('click',nextCase);
  qs('#delete-partial').addEventListener('click',deleteResponse);
  setupSpeechInput();
  const audio=qs('#judgment-audio');
  audio.addEventListener('play',()=>{state.audio.started=true;state.audio.status='available';updateAudioUI();saveDraft();});
  audio.addEventListener('pause',()=>{captureAudioPosition();updateAudioUI();saveDraft();});
  audio.addEventListener('timeupdate',()=>{if(state.replay.mode!=='audio'||pendingAudioPosition!==null)return;state.audio.positionSeconds=audio.currentTime||0;state.audio.maxPositionSeconds=Math.max(state.audio.maxPositionSeconds||0,audio.currentTime||0);updateAudioUI();});
  for(const event of ['loadedmetadata','loadeddata','canplay','progress'])audio.addEventListener(event,()=>{restoreAudioPosition();updateAudioUI();});
  audio.addEventListener('ended',()=>{state.audio.completed=true;state.replay.completed=true;updateAudioUI();saveDraft();});
  audio.addEventListener('seeking',()=>{if(pendingAudioPosition===null&&audio.currentTime>(state.audio.maxPositionSeconds||0)+0.5)audio.currentTime=state.audio.maxPositionSeconds||0;});
  audio.addEventListener('error',()=>{if(state.replay.mode!=='audio')return;state.audio.status='error';updateAudioUI();saveDraft();});
  window.addEventListener('pagehide',()=>{pausePlayback();stopExposure();captureForm();saveDraft();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pausePlayback();stopExposure();}else if(state.step==='replay')state.replayEnteredAt=Date.now();saveDraft();});
  setupOrientation();
  setInterval(tickExposure,250);
  qs('#narration-text').addEventListener('scroll',checkNarrationEnd);
  if(!draftBlocked)restoreDraft();
}
function setupSpeechInput(){
  speech?.destroy();speechChanged=false;
  speech=window.StudySpeech.create({textarea:qs('#open-response'),startButton:qs('#speech-start'),stopButton:qs('#speech-stop'),status:qs('#speech-status'),interim:qs('#speech-interim'),onChange:()=>{
    speechChanged=true;qs('#open-response-confirm').checked=false;updateOpenResponse();captureForm();saveDraft();
  }});
 }
function nextCase(){
  if(state.step!=='between'||state.deleted)return;
  try{
    if(!currentEpoch()||isDeleted(state.assignment.sessionId))throw Error('本次数据已被清空或删除，请刷新页面。');
    if(newerDraftExists())throw Error('另一页面已进入后续案件，请刷新当前页面以恢复最新进度。');
    const next=SESSION.advance(state.session);
    pausePlayback();stopExposure();initializingUI=true;
    pendingAudioPosition=null;
    const audio=qs('#judgment-audio');audio.removeAttribute('src');audio.load();
    Object.assign(state,{session:next,caseType:next.caseOrder[next.caseIndex],step:'dossier',response:null,reading:{},activeDossierTab:'overview',formValues:{},replayExposureMs:0,replayEnteredAt:null,speechMetadata:null,audio:{status:'not_supplied',started:false,completed:false,maxPositionSeconds:0,positionSeconds:0},replay:{mode:null,stream:null,completed:false}});
    state.responsibilityOrder=CORE.shuffle(CORE.subjectsFor(state.condition).map(x=>x.id));state.responsibilityStage='independent';
    qs('#survey-form').reset();qs('#transcript-confirm').checked=false;qs('#dossier-confirm').checked=false;
    for(const selector of ['#survey-error','#transcript-error','#dossier-error','#between-error'])qs(selector).textContent='';
    setupSpeechInput();initializeAssignedUI();setStep('dossier');
  }catch(error){qs('#between-error').textContent=error.message;}
  finally{initializingUI=false;}
}
function renderCaseProgress(){
  const session=state.session;if(!session)return;
  const done=SESSION.complete(session),between=state.step==='between';
  qs('#case-progress').classList.toggle('hidden',state.step==='intro'||state.deleted);
  qs('#case-progress-label').textContent=done?'已完成 2 / 2 个案件':between?'已完成 1 / 2 个案件':`第 ${session.caseIndex+1} / 2 个案件 · ${LABELS.cases[state.caseType]}`;
  qs('#case-progress-detail').textContent=done?'两案评价均已提交':between?'继续完成第二案后结束本次研究':'每个案件都需分别完成阅读、回放和评价';
  qs('#next-case-name').textContent=LABELS.cases[session.caseOrder[1]];
  qs('#submit-evaluation').textContent=session.caseIndex===0?'提交本案评价，继续第二案 →':'提交第二案，完成研究 →';
  if(state.preview)qs('#preview-condition-label').textContent=`${LABELS.roles[state.role]} · ${LABELS.conditions[state.condition]} · 第 ${session.caseIndex+1} 案：${LABELS.cases[state.caseType]}`;
}
function updateScreening(){
 const selected=name=>qs(`input[name="${name}"]:checked`)?.value;
 const toggle=(id,name,visible)=>{
   qs(id).classList.toggle('hidden',!visible);
   qsa(`input[name="${name}"]`).forEach(el=>{el.disabled=!visible;if(!visible){if(el.type==='radio')el.checked=false;else el.value='';}});
 };
 const industry=selected('legalIndustry');
 toggle('#occupation-question','legalOccupation',industry==='yes');
 const occupation=selected('legalOccupation');
 toggle('#occupation-detail-question','legalOccupationDetail',industry==='yes'&&occupation==='other');
 toggle('#occupation-other-field','legalOccupationOther',selected('legalOccupationDetail')==='other');
 const nonLawyer=industry==='no'||(industry==='yes'&&['judge','other'].includes(occupation));
 toggle('#judge-question','judgeCaseExperience',nonLawyer);
 toggle('#litigation-question','litigationExperience',nonLawyer&&selected('judgeCaseExperience')==='no');
 if(!state.preview)qs('#screening-note').textContent='';
}

function startStudy(){
  qs('#intro-error').textContent='';
  if(draftBlocked){qs('#intro-error').textContent='已有进度无法读取，请联系研究者处理后再继续。';return;}
  if(!qs('#consent-checkbox').checked){qs('#intro-error').textContent='请先确认同意参加。';return;}
  const background=Object.fromEntries(['legalIndustry','legalOccupation','legalOccupationDetail','judgeCaseExperience','legalDegree','litigationExperience'].map(name=>[name,qs(`input[name="${name}"]:checked`)?.value||null]));
  background.legalOccupationOther=qs('input[name="legalOccupationOther"]').value;
  try{
    if(!currentEpoch()){qs('#intro-error').textContent='研究者已清空测试数据，请刷新页面后开始新的体验。';return;}
    // Re-read before assigning so another tab's existing assignment is not rerandomized.
    const raw=draftStorage().getItem(draftKey);
    const prior=raw?JSON.parse(raw):null;
    const existing=prior?.epoch===storageEpoch?prior.assignment:state.assignment;
    if(state.needsRescreen&&(prior?.session?.responses?.length||readRecords().some(r=>r.sessionId===existing?.sessionId))){state.needsRescreen=false;restoreDraft();return;}
    state.assignment=CORE.assignParticipant(background,{existing,rescreen:Boolean(state.needsRescreen),sessionId:`JR-${token(8).toUpperCase()}`,preview:state.preview?previewSelection:null});
    Object.assign(state,{role:state.assignment.role,condition:state.assignment.condition,caseType:state.assignment.caseType});
    if(raw&&CORE.validAssignment(existing)&&!state.needsRescreen){restoreDraft();return;}
    if(state.needsRescreen){state.needsRescreen=false;state.reading={};state.orientation={};state.formValues={};state.replay={mode:null,completed:false};state.replayExposureMs=0;state.audio={status:'not_supplied',started:false,completed:false,maxPositionSeconds:0};state.speechMetadata=null;}
    state.consent={version:CONSENT_VERSION,acceptedAt:new Date().toISOString()};state.retained=true;
    state.session=SESSION.create(state.assignment);
    state.responsibilityOrder=CORE.shuffle(CORE.subjectsFor(state.condition).map(x=>x.id));state.responsibilityStage='independent';
    state.step='dossier';
    draftStorage().setItem(draftKey,JSON.stringify(snapshot()));
    initializeAssignedUI();setStep('dossier');
  }catch(error){state.step='intro';qs('#intro-error').textContent=error.message==='请完成所有背景问题。'?error.message:'无法保存本次分组，请允许浏览器保存本机数据后再试。';}
}
function initializeAssignedUI(){
  initializingUI=true;
  try{
  qs('#session-code').textContent=`体验编号：${state.assignment.sessionId}`;renderCaseProgress();
  qs('#role-perspective').textContent=NARRATION.rolePrompt(state.role,state.caseType);
  renderDossier();renderTranscript();renderDecision();renderResponsibility();renderRatings();restoreForm();updateResponsibilityUI();updateOpenResponse();
  }finally{initializingUI=false;}
}
function restoreDraft(){
  try{
    const raw=draftStorage().getItem(draftKey);if(!raw)return;
    const draft=JSON.parse(raw);
    const upgrade=JSON.parse(localStorage.getItem(PROTOCOL_KEY)||'null');
    if(draft.epoch===upgrade?.fromEpoch&&storageEpoch===upgrade?.toEpoch)draft.epoch=storageEpoch;
    if(draft.epoch!==storageEpoch){draftStorage().removeItem(draftKey);return;}
    if(draft.deleted||isDeleted(draft.assignment?.sessionId)){draftStorage().setItem(draftKey,JSON.stringify(deletionMarker(draft.sessionId||draft.assignment.sessionId)));state.deleted=true;state.response=null;state.formValues={};qs('#session-code').textContent='本次回答已删除';markDeleted();setStep('debrief',false);return;}
    if(![CORE.VERSION,'2.1.0','2.0.0'].includes(draft.version)||!CORE.validAssignment(draft.assignment)||!STEPS.includes(draft.step))throw Error('invalid draft');
    Object.assign(state,{assignment:draft.assignment,role:draft.assignment.role,condition:draft.assignment.condition,caseType:draft.assignment.caseType,step:draft.step,reading:draft.version===CORE.VERSION?(draft.reading||{}):{},activeDossierTab:draft.activeDossierTab||'overview',formValues:draft.formValues||{},replayExposureMs:draft.replayExposureMs||0,response:draft.response||null,deleted:Boolean(draft.deleted),audio:draft.audio||state.audio,speechMetadata:draft.speechMetadata||null,replay:draft.replay||{mode:null,version:'legacy_monologue',stream:null,completed:false}});
    state.orientation=draft.orientation||{};state.consent=draft.consent||null;
    state.session=SESSION.restore(state.assignment,draft);state.retained=draft.retained??null;
    // A saved answer wins if the following draft write was interrupted or another tab finished first.
    const stored=readRecords().find(r=>r.sessionId===state.assignment.sessionId);
    if(stored?.protocol===SESSION.VERSION){
      const savedSession=SESSION.restore(state.assignment,{session:stored});
      if(savedSession.responses.length>state.session.responses.length)state.session=savedSession;
      state.retained=stored.retained??state.retained;
    }else if(stored){
      const legacy=SESSION.restore(state.assignment,{response:stored});
      state.session=state.session.responses.length?{...state.session,responses:[stored,...state.session.responses.slice(1)],migratedFrom:legacy.migratedFrom}:legacy;
    }
    state.caseType=state.session.caseOrder[state.session.caseIndex];
    state.response=state.session.responses[state.session.caseIndex]||null;
    if(state.response)state.step=SESSION.complete(state.session)?'debrief':'between';
    if(!state.preview&&!state.session.responses.length&&state.assignment.screeningVersion!==CORE.SCREENING_VERSION){
      state.needsRescreen=true;state.step='intro';
      for(const name of ['legalIndustry','legalOccupation','legalOccupationDetail','judgeCaseExperience','legalDegree','litigationExperience']){const value=state.assignment.background[name];const input=qs(`input[name="${name}"][value="${value}"]`);if(input)input.checked=true;}
      updateScreening();qs('#consent-checkbox').checked=Boolean(state.consent);
      qs('#intro-error').textContent='背景题已更新，请先确认法律相关从业情况，再核对其余问题。原案件顺序和 AI 条件将保留。';
      setStep('intro',false);return;
    }
    // Preserve a randomized display order, never reinterpret an old ranking as scores.
    const order=draft.responsibilityOrder||draft.rankingInitial;
    state.responsibilityOrder=CORE.validRanking(order,state.condition)?[...order]:CORE.shuffle(CORE.SUBJECTS.map(s=>s.id));
    state.responsibilityStage=draft.responsibilityMeasure===CORE.RESPONSIBILITY_VERSION&&draft.responsibilityStage==='allocation'?'allocation':'independent';
    if(draft.responsibilityMeasure!==CORE.RESPONSIBILITY_VERSION){
      for(const key of Object.keys(state.formValues))if(key.startsWith('responsibility_'))delete state.formValues[key];
      delete state.formValues.rankingConfirm;delete state.formValues.rankingMode;
    }
    if(draft.version!==CORE.VERSION&&!state.response){state.step='dossier';state.audio={status:'not_supplied',started:false,completed:false,maxPositionSeconds:0};}
    // New role/case footage requires a fresh unsubmitted trial, while preserving assignment and submitted answers.
    const mediaChanged=!state.response&&state.orientation[state.caseType]?.version!==window.STUDY_ROLE_MEDIA?.version;
    if(mediaChanged){
      state.reading={};state.activeDossierTab='overview';state.formValues={};state.speechMetadata=null;
      state.replay={mode:null,version:'previous_role_media',completed:false};
      state.audio={status:'not_supplied',started:false,completed:false,maxPositionSeconds:0};
      state.step='dossier';
    }
    initializeAssignedUI();qs('#transcript-confirm').checked=!mediaChanged&&state.replay.completed&&Boolean(draft.transcriptConfirmed);updatePlaybackGate();
    if(!state.response){
      if(!CORE.readingComplete(state.reading))state.step='dossier';
      else if((!state.replay.completed||!qs('#transcript-confirm').checked)&&['decision','survey'].includes(state.step))state.step='replay';
    }
    if(state.deleted)markDeleted();setStep(state.step,false);saveDraft();
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
function snapshot(){if(state.deleted)return deletionMarker(state.assignment?.sessionId);return {epoch:storageEpoch,version:CORE.VERSION,assignment:state.assignment,session:state.session,retained:state.retained,consent:state.consent,orientation:state.orientation,step:state.step,responsibilityMeasure:CORE.RESPONSIBILITY_VERSION,responsibilityOrder:state.responsibilityOrder,responsibilityStage:state.responsibilityStage,reading:state.reading,activeDossierTab:state.activeDossierTab,formValues:state.formValues,replayExposureMs:exposure(),transcriptConfirmed:qs('#transcript-confirm').checked,response:state.response,deleted:state.deleted,audio:state.audio,replay:{...state.replay},speechMetadata:mergedSpeechMetadata()};}
function saveDraft(){
  if(!state.assignment||state.needsRescreen||draftBlocked||initializingUI)return;
  try{
    if(!currentEpoch()||newerDraftExists())return;
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
function renderDossier(){
 qs('#case-category-badge').textContent=CASES[state.caseType].category;
 const index=CORE.DOSSIER_TABS.indexOf(state.activeDossierTab);
 if(index<0||CORE.DOSSIER_TABS.slice(0,index).some(k=>!state.reading[k]?.confirmed))state.activeDossierTab='overview';
 showDossierTab(state.activeDossierTab,false);
}
function showDossierTab(tab,persist=true){
  if(!CORE.DOSSIER_TABS.includes(tab))return;
  if(CORE.DOSSIER_TABS.slice(0,CORE.DOSSIER_TABS.indexOf(tab)).some(k=>!state.reading[k]?.confirmed))return;
  state.activeDossierTab=tab;
  state.reading[tab]||={reachedEnd:false,confirmed:false,visibleMs:0};
  qsa('.dossier-tabs button').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.tab===tab)));
  const data=CASES[state.caseType];
  if(tab==='overview')qs('#dossier-content').innerHTML=`<div class="dossier-title"><div><h2>${data.category}</h2><p>${data.number}</p></div><span class="dossier-tag">${data.tag}</span></div><div class="fact-grid">${data.overview.facts.map(([k,v])=>`<div class="fact-box"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div><p class="dossier-summary">${data.overview.summary}</p>`;
  else if(tab==='evidence')qs('#dossier-content').innerHTML=`<div class="dossier-title"><div><h2>材料与证据摘要</h2><p>${data.evidenceNote}</p></div></div><div class="evidence-list">${data.evidence.map(([id,title,detail,status])=>`<div class="evidence-item"><span>${id}</span><div><strong>${title}</strong><small>${detail}</small></div><em class="evidence-status">${status}</em></div>`).join('')}</div>`;
  else qs('#dossier-content').innerHTML=`<div class="dossier-title"><div><h2>裁判任务</h2><p>请理解裁判需要回应的问题</p></div></div><div class="task-prompt"><p>${data.task}</p></div><div class="issue-list">${data.issues.map((issue,index)=>`<div><span>0${index+1}</span><p>${issue}</p></div>`).join('')}</div>`;
  const panel=qs('#dossier-content');panel.scrollTop=0;panel.setAttribute('aria-labelledby',`tab-${tab}`);
  updateReadingUI();requestAnimationFrame(checkReadingEnd);
  if(persist)saveDraft();
}
function checkReadingEnd(){
  const panel=qs('#dossier-content');
  if(state.step!=='dossier'||!panel.clientHeight)return;
  const progress=state.reading[state.activeDossierTab];
  if(progress&&!progress.reachedEnd&&panel.scrollTop+panel.clientHeight>=panel.scrollHeight-3){progress.reachedEnd=true;updateReadingUI();saveDraft();}
}
function updateReadingUI(){
  const labels={overview:'案件总览',evidence:'主要证据',task:'裁判任务'};
  const progress=state.reading[state.activeDossierTab]||{};
  qs('#dossier-confirm').disabled=!progress.reachedEnd||!(progress.visibleMs>=CORE.MIN_READING_MS);qs('#dossier-confirm').checked=Boolean(progress.confirmed);
  qs('#dossier-confirm-label').textContent=`我已完整阅读${labels[state.activeDossierTab]}。`;
  qs('#reading-hint').textContent=!(progress.visibleMs>=CORE.MIN_READING_MS)?`请阅读本栏，至少还需 ${Math.ceil((CORE.MIN_READING_MS-(progress.visibleMs||0))/1000)} 秒。`:progress.confirmed?'本栏已确认，可切换到其他栏目阅读。':progress.reachedEnd?'已到本栏末尾，请勾选下方确认。':'请在材料框内向下滚动，阅读至本栏末尾后确认。';
  const count=CORE.DOSSIER_TABS.filter(tab=>state.reading[tab]?.reachedEnd&&state.reading[tab]?.confirmed).length;
  qs('#reading-progress').textContent=`已完成 ${count} / 3 栏`;
  qs('#to-replay').disabled=!CORE.readingComplete(state.reading);
  qsa('.dossier-tabs button').forEach((button,index)=>{button.disabled=CORE.DOSSIER_TABS.slice(0,index).some(k=>!state.reading[k]?.confirmed);const done=state.reading[button.dataset.tab]?.confirmed;button.textContent=labels[button.dataset.tab]+(done?' ✓':'');});
}
function beginReplay(){
  if(!orientation().completed||!state.consent)return;
  if(!CORE.readingComplete(state.reading)){qs('#dossier-error').textContent='请依次阅读三个案卷栏目，并确认已阅读。';return;}
  qs('#dossier-error').textContent='';setStep('replay');
}
function renderTranscript(){
 const completeAudio=window.STUDY_AUDIO_VERSION===NARRATION.VERSION&&CORE.CASE_TYPES.every(k=>{try{const value=window.STUDY_AUDIO?.[k];return typeof value==='string'&&Boolean(value)&&new URL(value,location.href).origin===location.origin;}catch{return false;}});
 const mode=completeAudio?'audio':'text';
 const changed=state.replay.version!==NARRATION.VERSION||state.replay.mode!==mode;
 if(changed){
  const materialChanged=Boolean(state.replay.version||state.replay.mode);
  state.replay={mode,version:NARRATION.VERSION,completed:false,textReachedEnd:false,textVisibleMs:0,materialChanged};
  state.audio={status:'not_supplied',started:false,completed:false,maxPositionSeconds:0,positionSeconds:0};
  state.replayExposureMs=0;state.replayEnteredAt=null;qs('#transcript-confirm').checked=false;
  if(materialChanged&&!state.response){state.formValues={};state.speechMetadata=null;qs('#survey-form').reset();state.responsibilityStage='independent';}
 }
 qs('#condition-disclosure').textContent=NARRATION.conditionLine(state.condition);
 qs('#narration-text').innerHTML=NARRATION.paragraphsFor(state.caseType).map(p=>`<p>${escapeHtml(p)}</p>`).join('');
 qs('#audio-panel').classList.toggle('hidden',mode!=='audio');
 qs('#playback-confirm-label').textContent=mode==='audio'?'我已完整收听并了解这份裁判形成记录。':'我已完整阅读并了解这份裁判形成记录。';
 qs('#playback-source').textContent=mode==='audio'?'请收听法官陈述，下方文字可辅助理解。该陈述及配音均为模拟研究材料。':'请阅读下方完整陈述。本记录是依据案例编写的模拟材料。';
 if(mode==='audio'){
  pendingAudioPosition=state.audio.positionSeconds||0;qs('#judgment-audio').src=new URL(window.STUDY_AUDIO[state.caseType],location.href).href;
  state.audio.status='configured';state.replay.completed=Boolean(state.audio.completed);updateAudioUI();
 }else{pendingAudioPosition=null;qs('#judgment-audio').removeAttribute('src');state.audio.status='not_supplied';}
 updatePlaybackGate();
}
function checkNarrationEnd(){
 const el=qs('#narration-text');if(state.step!=='replay'||!el.clientHeight)return;
 if(el.scrollTop+el.clientHeight>=el.scrollHeight-3)state.replay.textReachedEnd=true;
 updatePlaybackGate();
}
function updatePlaybackGate(){
  if(state.replay.mode==='text')state.replay.minTextMs=NARRATION.MIN_TEXT_MS;
  if(state.replay.mode==='text')state.replay.completed=Boolean(state.replay.textReachedEnd&&state.replay.textVisibleMs>=NARRATION.MIN_TEXT_MS);
  qs('#narration-reading-status').textContent=state.replay.mode==='audio'?'可边听边阅读下方文字，完整收听后继续。':state.replay.completed?'全文已阅读，请勾选确认后继续。':`请将正文阅读至末尾，并至少阅读 ${NARRATION.MIN_TEXT_MS/1000} 秒。${state.replay.textVisibleMs<NARRATION.MIN_TEXT_MS?'还需 '+Math.ceil((NARRATION.MIN_TEXT_MS-(state.replay.textVisibleMs||0))/1000)+' 秒。':''}`;
  qs('#dialogue-update-note').classList.toggle('hidden',!state.replay.materialChanged||state.replay.completed||Boolean(state.response));
  qs('#transcript-confirm').disabled=!state.replay.completed;
  if(!state.replay.completed)qs('#transcript-confirm').checked=false;
  qs('#to-decision').disabled=!(state.replay.completed&&qs('#transcript-confirm').checked);
}
function updateAudioUI(){
  if(state.replay.mode!=='audio')return;
  const audio=qs('#judgment-audio'),duration=Number.isFinite(audio.duration)?audio.duration:0;
  qs('#playback-phase').textContent=state.audio.completed?'裁判过程播放完毕':'裁判形成记录 · 语音回放';
  qs('#playback-progress').value=duration?Math.round(audio.currentTime/duration*100):0;
  qs('#playback-toggle').disabled=Boolean(audio.ended);
  qs('#playback-toggle').textContent=state.audio.status==='error'?'重试播放':audio.ended?'已完整播放':audio.paused?(state.audio.started?'继续播放':'开始播放'):'暂停播放';
  const seconds=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
  qs('#audio-status').textContent=state.audio.status==='error'?'录音暂时无法播放，请重试。完整收听后才能继续。':audio.ended?'已完整收听，请确认后查看最终裁判。':`${seconds(audio.currentTime||0)} / ${duration?seconds(duration):'等待载入'} · ${audio.paused?'点击播放，按顺序收听。':'正在播放…'}`;
  updatePlaybackGate();
}
function captureAudioPosition(){
  const audio=qs('#judgment-audio');
  if(state.replay.mode==='audio'&&pendingAudioPosition===null&&audio.readyState>0){state.audio.positionSeconds=audio.currentTime||0;state.audio.maxPositionSeconds=Math.max(state.audio.maxPositionSeconds||0,state.audio.positionSeconds);}
}
function restoreAudioPosition(){
  const audio=qs('#judgment-audio');
  if(pendingAudioPosition===null||!Number.isFinite(audio.duration))return;
  const target=Math.min(pendingAudioPosition,audio.duration);
  // Metadata may arrive before any part of the recording is seekable.
  const seekable=target===0||Array.from({length:audio.seekable.length},(_,i)=>i).some(i=>audio.seekable.start(i)<=target&&audio.seekable.end(i)>=target);
  if(!seekable)return;
  audio.currentTime=target;state.audio.positionSeconds=target;pendingAudioPosition=null;
}
function pausePlayback(){qs('#judgment-audio').pause();captureAudioPosition();qs('#role-video').pause();}
async function togglePlayback(){
  const audio=qs('#judgment-audio');
  if(!audio.paused){audio.pause();captureAudioPosition();saveDraft();return;}
  try{if(state.audio.status==='error'){pendingAudioPosition=state.audio.positionSeconds||0;audio.load();state.audio.status='configured';}restoreAudioPosition();await audio.play();}
  catch{state.audio.status='error';updateAudioUI();saveDraft();}
}
function restartPlayback(){
  pausePlayback();state.replay.completed=false;qs('#transcript-confirm').checked=false;
  {state.audio.completed=false;state.audio.positionSeconds=0;pendingAudioPosition=0;qs('#judgment-audio').currentTime=0;togglePlayback();}
  updatePlaybackGate();saveDraft();
}
function renderDecision(){
  const data=CASES[state.caseType];qs('#judgment-case-number').textContent=data.number;qs('#judgment-court').textContent=data.court;
  qs('#judgment-content').innerHTML=`<h2>刑事裁判摘要（研究材料）</h2>${data.judgment.map(p=>`<p>${p}</p>`).join('')}<ol>${data.orders.map(p=>`<li>${p}</li>`).join('')}</ol>`;
}
function renderResponsibility(){
  for(const kind of ['score','allocation']){
    qs(`#responsibility-${kind}-list`).innerHTML=state.responsibilityOrder.map(id=>{
      const subject=CORE.SUBJECTS.find(s=>s.id===id),inputId=`responsibility-${kind}-${id}`;
      return `<div class="responsibility-item"><div><label for="${inputId}">${subject.label}</label><p id="${inputId}-description">${subject.description}</p></div><div class="responsibility-value"><input id="${inputId}" name="responsibility_${kind}_${id}" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="未填" required aria-describedby="${inputId}-description ${kind==='score'?'independent':'allocation'}-help"><span>分</span></div></div>`;
    }).join('');
  }
}
function responsibilityInput(kind){return Object.fromEntries(CORE.SUBJECTS.map(s=>[s.id,qs(`#responsibility-${kind}-${s.id}`).value]));}
function validResponsibility(kind){try{return CORE.responsibilityValues(responsibilityInput(kind),kind==='allocation');}catch{return null;}}
function updateResponsibilityUI(){
  const scores=validResponsibility('score');
  if(!scores)state.responsibilityStage='independent';
  const allocationStage=state.responsibilityStage==='allocation';
  for(const [id,active] of [['independent',!allocationStage],['allocation',allocationStage]]){
    const field=qs(`#responsibility-${id}`);field.classList.toggle('hidden',!active);field.disabled=!active;
  }
  qs('#to-allocation').disabled=!scores;
  const filled=Object.values(responsibilityInput('score')).filter(v=>v!=='').length;
  qs('#score-status').textContent=scores?'四项评分已填写，可以进入责任分配。':`已填写 ${filled} / 4 项，请为每项填写 0–100 的整数。`;
  const allocation=validResponsibility('allocation'),raw=responsibilityInput('allocation');
  const numbers=Object.values(raw).map(v=>/^\d{1,3}$/.test(v)&&Number(v)<=100?Number(v):null);
  const total=numbers.reduce((sum,v)=>sum+(v??0),0),missing=numbers.filter(v=>v===null).length;
  const balance=total<100?`还差 ${100-total} 分`:total>100?`超出 ${total-100} 分`:'合计已达 100 分';
  qs('#allocation-status').textContent=`已分配 ${total} / 100 分 · ${balance}${missing?`；还有 ${missing} 项未填写或无效，没有责任请填 0。`:allocation?'，可以继续作答。':'，请调整后继续。'}`;
  qs('#allocation-status').classList.toggle('complete',Boolean(allocation));
  qs('#submit-evaluation').disabled=!(scores&&allocationStage&&allocation);
}
function changeResponsibilityStage(stage){
  if(stage==='allocation'&&!validResponsibility('score'))return;
  state.responsibilityStage=stage;updateResponsibilityUI();captureForm();saveDraft();
  const field=qs(`#responsibility-${stage}`);field.scrollIntoView({behavior:'smooth',block:'start'});qs('input',field)?.focus({preventScroll:true});
}

function ratingApplicable(){return true;}

function renderRatings(){
  qs('#involvement-options').innerHTML=CORE.SCALE.map((label,i)=>`<label><input type="radio" name="involvement" value="${i+1}" required><span class="likert-score">${i+1}</span><span>${label}</span></label>`).join('');
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
  if(!orientation().completed||!state.consent){qs('#survey-error').textContent='请先完成情境说明。';return;}
  if(speech.isBusy()){qs('#survey-error').textContent='请先停止语音输入，等待识别结束并核对文字后提交。';return;}
  if(state.response||state.deleted)return;
  if(!CORE.readingComplete(state.reading)||!state.replay.completed||!qs('#transcript-confirm').checked){qs('#survey-error').textContent='请先完成三栏材料阅读和裁判过程回放。';return;}
  const form=event.currentTarget;if(!form.reportValidity()){qs('#survey-error').textContent='请完成所有必答题和确认项。';return;}
  try{
    const data=new FormData(form),ratings={},ratingStatus={};
    for(const [name]of RATINGS){const result=CORE.ratingValue(data.get(name),ratingApplicable(name));ratings[name]=result.value;ratingStatus[name]=result.status;}
    if(state.responsibilityStage!=='allocation')throw Error('请先完成独立评分，再进行责任分配。');
    const responsibilityScores=CORE.responsibilityValues(responsibilityInput('score'));
    const responsibilityAllocation=CORE.responsibilityValues(responsibilityInput('allocation'),true);
    stopExposure();captureForm();
    const response={version:CORE.VERSION,caseVersion:window.StudyContent.version,narrationVersion:NARRATION.VERSION,conditionLine:NARRATION.conditionLine(state.condition),consent:state.consent,orientation:structuredClone(state.orientation[state.caseType]||{}),sessionId:state.assignment.sessionId,role:state.role,screeningVersion:state.assignment.screeningVersion||state.assignment.version,backgroundGroup:state.assignment.backgroundGroup||null,reading:structuredClone(state.reading),background:state.assignment.background,roleAssignment:state.assignment.roleAssignment,condition:state.condition,caseType:state.caseType,preview:state.preview,assignment:state.assignment,replayCompleted:state.replay.completed&&qs('#transcript-confirm').checked,replayExposureMs:state.replayExposureMs,presentation:state.replay.mode==='audio'?'shared_audio_and_text':'shared_plain_text',playback:{...state.replay},audio:{...state.audio},manipulationCheck:data.get('manipulationCheck'),finalSigner:data.get('finalSigner'),responsibilityMeasure:CORE.RESPONSIBILITY_VERSION,responsibilityOrder:[...state.responsibilityOrder],responsibilityScores,responsibilityAllocation,responsibilityAllocationTotal:Object.values(responsibilityAllocation).reduce((sum,value)=>sum+value,0),ratings,ratingStatus,involvement:Number(data.get('involvement')),openResponse:String(data.get('openResponse')||''),speech:mergedSpeechMetadata(),retained:true,submittedAt:new Date().toISOString(),prototype:true};
    const session=SESSION.submit(state.session,response,state.assignment);
    updateSavedResponse(SESSION.record(session,state.assignment,true));state.retained=true;state.session=session;state.response=response;setStep(SESSION.complete(session)?'debrief':'between');
  }catch(error){qs('#survey-error').textContent=`未提交：${error.message}`;}
}


function markDeleted(){
  qs('#case-progress').classList.add('hidden');qs('#screen-debrief h1').textContent='本次作答已退出';qs('#screen-debrief .lead').textContent='本次两个案件的回答及未完成进度已从当前浏览器删除。';
  qs('#retain-status').textContent='本次回答和未完成内容已从当前浏览器删除。';
  qs('#delete-response').disabled=true;qs('#download-response').disabled=true;
}
function deleteResponse(){
  if(!state.response||state.deleted)return;
  try{
    if(!currentEpoch())throw Error('测试数据已经清空。');
    const sessionId=state.response.sessionId;
    const ids=deletedSessions();if(!ids.includes(sessionId))ids.push(sessionId);localStorage.setItem(DELETED_KEY,JSON.stringify(ids));
    const records=readRecords().filter(x=>x.sessionId!==sessionId);localStorage.setItem(STORAGE_KEY,JSON.stringify(records));
    // Keep only assignment and completion marker to prevent refresh from resurrecting deleted answers.
    state.response=null;state.session=null;state.retained=null;state.formValues={};state.speechMetadata=null;state.deleted=true;
    qs('#survey-form').reset();speech.destroy();qs('#open-response').value='';
    draftStorage().removeItem(draftKey);setStep('debrief');saveDraft();markDeleted();
  }catch{qs(state.step==='between'?'#between-error':'#retain-status').textContent='删除未完成，请重试。';}
}
function downloadResponse(){if(!state.response||state.deleted)return;try{if(!currentEpoch()||isDeleted(state.response.sessionId)){qs('#retain-status').textContent='本次数据已被删除或清空，不能下载。';return;}downloadBlob(JSON.stringify(SESSION.record(state.session,state.assignment,state.retained),null,2),`${state.response.sessionId}.json`,'application/json');}catch{qs('#retain-status').textContent='无法确认数据状态，请刷新页面后重试。';}}
function setStep(step,persist=true){
  if(!STEPS.includes(step))return;
  if(step==='debrief'&&!state.deleted&&state.session&&!SESSION.complete(state.session))step=state.response?'between':state.step;
  if(state.step==='replay')stopExposure();
  if(step!=='replay')pausePlayback();
  if(step!=='survey'&&speech?.isBusy())speech.stop();
  state.step=step;if(step==='replay'&&!document.hidden)state.replayEnteredAt=Date.now();
  qsa('.study-screen').forEach(screen=>screen.classList.toggle('active',screen.id===`screen-${step}`));
  renderCaseProgress();
  const current=step==='between'?4:STEPS.indexOf(step);qsa('.study-progress li').forEach((item,i)=>{item.classList.toggle('active',i===current);item.classList.toggle('done',i<current);});
  window.scrollTo({top:0,behavior:'instant'});if(step==='replay')requestAnimationFrame(checkNarrationEnd);if(step==='dossier'){requestAnimationFrame(checkReadingEnd);openOrientation();}if(persist)saveDraft();
}
function readRecords(){const raw=localStorage.getItem(STORAGE_KEY);const records=raw?JSON.parse(raw):[];if(!Array.isArray(records))throw Error('已有记录无法读取，不能覆盖。');return records;}
function updateSavedResponse(response){
  if(!currentEpoch()||isDeleted(response.sessionId))throw Error('本次数据已被删除或清空，不能再次保存。');
  const records=readRecords(),index=records.findIndex(x=>x.sessionId===response.sessionId),existing=records[index];
  if(existing&&!existing.protocol&&JSON.stringify(existing)!==JSON.stringify(response.responses?.[0]))throw Error('已有已提交的首案回答，请刷新页面后继续。');
  if(existing?.protocol===SESSION.VERSION&&existing.responses.some((r,i)=>JSON.stringify(r)!==JSON.stringify(response.responses[i])))throw Error('已有更新的案件回答，请刷新页面后继续。');
  if(index<0)records.push(response);else records[index]=response;localStorage.setItem(STORAGE_KEY,JSON.stringify(records));
}
function renderRecords(){
  let records;try{records=readRecords();}catch{qs('#records-body').innerHTML='<tr><td colspan="6">已有记录无法读取，未作覆盖。请联系研究者处理。</td></tr>';return;}
  const rows=SESSION.rows(records);
  const numeric=rows.filter(x=>typeof x.ratings?.fairness==='number');const allocated=rows.filter(x=>x.responsibilityMeasure===CORE.RESPONSIBILITY_VERSION&&typeof x.responsibilityAllocation?.judge==='number');
  qs('#metric-complete').textContent=records.filter(r=>r.protocol===SESSION.VERSION&&r.completed).length;
  qs('#metric-fairness').textContent=numeric.length?(numeric.reduce((sum,x)=>sum+x.ratings.fairness,0)/numeric.length).toFixed(1):'—';
  qs('#metric-judge-allocation').textContent=allocated.length?`${(allocated.reduce((sum,x)=>sum+x.responsibilityAllocation.judge,0)/allocated.length).toFixed(1)} 分`:'—';
  qs('#metric-latest').textContent=records.length?formatTime(records.reduce((latest,r)=>Date.parse(r.submittedAt)>Date.parse(latest||0)?r.submittedAt:latest,null)):'—';
  qs('#records-body').innerHTML=rows.length?rows.slice().reverse().map(item=>`<tr><td>${escapeHtml(item.sessionId)}<small>${item.studyProtocol==='single_case'?'旧版单案':`第 ${item.caseNumber} / 2 案 · ${item.studyCompleted?'两案完成':'尚未完成两案'}`}</small></td><td>${escapeHtml(LABELS.roles[item.role]||item.role)}<small>v${escapeHtml(item.version||'1')} ${item.preview?'预览':''} · ${item.responsibilityMeasure?'评分＋分配':'旧版排序'}</small></td><td>${escapeHtml(LABELS.conditions[item.condition]||item.condition)}</td><td>${escapeHtml(item.version?LABELS.cases[item.caseType]:item.caseType==='natural'?'旧版故意伤害':'旧版数据处置')}</td><td>${escapeHtml(item.ratings?.fairness??'—')}</td><td>${formatTime(item.submittedAt)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty-cell">尚无测试记录。完成参与者流程后可在这里查看与导出。</td></tr>';
}
function exportCsv(){
  let records;try{records=readRecords();}catch{return toast('已有记录无法读取，未作覆盖。');}if(!records.length)return toast('当前没有可导出的记录');
  const header=['session_id','study_protocol','case_number','case_order','study_completed','migrated_from','version','case_version','dialogue_version','narration_version','condition_line','consent','orientation','preview','role','role_assignment','background_group','legal_industry','legal_occupation','legal_occupation_detail','legal_occupation_other','judge_case_experience','judge_case_experience_status','practicing_lawyer','license_active','legal_education','legal_degree','litigation_experience','litigation_experience_status','screening_version','reading_progress','condition','case_type','presentation','replay_completed','replay_exposure_ms','ranking_status','ranking_ids','ranking_labels','ranking_initial','responsibility_measure','responsibility_order',...CORE.SUBJECTS.map(s=>'responsibility_score_'+s.id),...CORE.SUBJECTS.map(s=>'responsibility_allocation_'+s.id),'responsibility_allocation_total',...RATINGS.flatMap(([k])=>[k,k+'_status']),'manipulation_check','final_signer','involvement','open_response','speech_metadata','audio_metadata','retained','submitted_at'];
  const rows=SESSION.rows(records).map(r=>[r.sessionId,r.studyProtocol,r.caseNumber,JSON.stringify(r.caseOrder),r.studyCompleted,r.migratedFrom,r.version||'1',r.caseVersion||'legacy',r.dialogueVersion||'',r.narrationVersion||'',r.conditionLine||'',JSON.stringify(r.consent||null),JSON.stringify(r.orientation||null),r.preview,r.role,r.roleAssignment||'self_selected',r.backgroundGroup||r.assignment?.backgroundGroup||'',r.background?.legalIndustry,r.background?.legalOccupation,r.background?.legalOccupationDetail,r.background?.legalOccupationOther,r.background?.judgeCaseExperience,r.background?.judgeCaseExperienceStatus,r.background?.practicingLawyer,r.background?.licenseActive,r.background?.legalEducation,r.background?.legalDegree,r.background?.litigationExperience,r.background?.litigationExperienceStatus,r.screeningVersion||r.assignment?.version,JSON.stringify(r.reading||null),r.condition,r.caseType,r.presentation,r.replayCompleted,r.replayExposureMs,r.rankingStatus||(r.responsibilityMeasure?'not_collected':'legacy'),JSON.stringify(r.rankingIds||[]),JSON.stringify(r.ranking||[]),JSON.stringify(r.rankingInitial||[]),r.responsibilityMeasure||'ranking_legacy',JSON.stringify(r.responsibilityOrder||[]),...CORE.SUBJECTS.map(s=>r.responsibilityScores?.[s.id]??''),...CORE.SUBJECTS.map(s=>r.responsibilityAllocation?.[s.id]??''),r.responsibilityAllocationTotal??'',...RATINGS.flatMap(([k])=>[r.ratings?.[k],r.ratingStatus?.[k]||'legacy']),r.manipulationCheck,r.finalSigner,r.involvement??'',r.openResponse,JSON.stringify(r.speech||null),JSON.stringify(r.audio||null),r.retained,r.submittedAt]);
  downloadBlob([header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n'),'judicial-ai-prototype.csv','text/csv;charset=utf-8');
}
function valid(value,choices,fallback){return choices.includes(value)?value:fallback;}
function token(length){const chars='abcdefghjkmnpqrstuvwxyz23456789';return Array.from({length},()=>CORE.choose([...chars])).join('');}
function formatTime(value){const date=new Date(value);return value&&!Number.isNaN(date.valueOf())?new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date):'—';}
function csvCell(value){let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`;}
function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function downloadBlob(content,filename,type){const blob=new Blob(type.startsWith('text/csv')?['\ufeff',content]:[content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function toast(message){clearTimeout(toastTimer);qs('#toast').textContent=message;qs('#toast').classList.remove('hidden');toastTimer=setTimeout(()=>qs('#toast').classList.add('hidden'),3500);}

function orientation(){
 const version=window.STUDY_ROLE_MEDIA?.version||'text-v1';
 const old=state.orientation[state.caseType];
 if(!old||old.version!==version)state.orientation[state.caseType]={version,visibleMs:0,completed:false,videoCompleted:false,videoMax:0};
 return state.orientation[state.caseType];
}
function roleMediaReady(){return CORE.CASE_TYPES.every(caseType=>CORE.ROLES.every(role=>{try{const asset=window.STUDY_ROLE_MEDIA?.cases?.[caseType]?.[role];return asset?.src&&new URL(asset.src,location.href).origin===location.origin;}catch{return false;}}));}
function setupOrientation(){
 const dialog=qs('#role-dialog'),video=qs('#role-video');
 for(const event of ['play','pause','ended'])video.addEventListener(event,()=>{qs('#role-video-play').textContent=video.ended?'重新观看':video.paused?(video.currentTime?'继续播放':'播放情境短片'):'暂停播放';});
 dialog.addEventListener('cancel',e=>e.preventDefault());
 qs('#role-video-play').addEventListener('click',async()=>{
  if(!video.paused){video.pause();qs('#role-video-play').textContent='继续播放';return;}
  try{if(video.error)video.load();await video.play();orientation().videoError=false;qs('#role-video-play').textContent='暂停播放';}catch{orientation().videoError=true;updateOrientation();}
 });
 video.addEventListener('ended',()=>{orientation().videoCompleted=true;qs('#role-video-play').textContent='重新观看';updateOrientation();saveDraft();});
 video.addEventListener('timeupdate',()=>{orientation().videoMax=Math.max(orientation().videoMax||0,video.currentTime||0);});
 video.addEventListener('seeking',()=>{if(video.currentTime>(orientation().videoMax||0)+.5)video.currentTime=orientation().videoMax||0;});
 video.addEventListener('error',()=>{orientation().videoError=true;updateOrientation();});
 qs('#updated-consent-checkbox').addEventListener('change',updateOrientation);
 qs('#role-continue').addEventListener('click',()=>{
  if(!orientationReady())return;
  if(!state.consent)state.consent={version:CONSENT_VERSION,acceptedAt:new Date().toISOString()};
  orientation().completed=true;state.retained=true;video.pause();dialog.close();exposureTick=performance.now();saveDraft();
 });
}
function orientationReady(){const o=orientation();return o.visibleMs>=NARRATION.MIN_ROLE_MS&&(!roleMediaReady()||o.videoCompleted)&&Boolean(state.consent||qs('#updated-consent-checkbox').checked);}
function updateOrientation(){
 const o=orientation();qs('#role-continue').disabled=!orientationReady();
 const seconds=Math.max(0,Math.ceil((NARRATION.MIN_ROLE_MS-o.visibleMs)/1000));
 qs('#role-status').textContent=o.videoError?'短片暂时无法播放，请点击播放重试或刷新页面。':seconds?`请代入以上情境，至少阅读 ${seconds} 秒。`:roleMediaReady()&&!o.videoCompleted?`请完整观看 ${window.STUDY_ROLE_MEDIA.durationSeconds} 秒情境短片，再进入案件材料。`:!state.consent&&!qs('#updated-consent-checkbox').checked?'请确认更新后的研究用途说明。':'请保持这一视角，开始阅读本案材料。';
}
function openOrientation(){
 if(state.deleted||state.response||orientation().completed&&state.consent)return;
 const dialog=qs('#role-dialog'),video=qs('#role-video');
 qs('#role-title').textContent=LABELS.roles[state.role];qs('#role-description').textContent=NARRATION.rolePrompt(state.role,state.caseType);
 qs('#updated-consent').classList.toggle('hidden',Boolean(state.consent));
 qs('#role-video-panel').classList.toggle('hidden',!roleMediaReady());
 if(roleMediaReady()){const media=window.STUDY_ROLE_MEDIA.cases[state.caseType][state.role];video.src=media.src;video.poster=media.poster;qs('#role-video-play').textContent='播放情境短片';video.load();}
 updateOrientation();if(!dialog.open)dialog.showModal();exposureTick=performance.now();
}
function tickExposure(){
 const now=performance.now(),delta=Math.min(500,Math.max(0,now-exposureTick));exposureTick=now;
 if(document.hidden||!state.assignment||state.deleted)return;
 if(qs('#role-dialog').open){orientation().visibleMs+=delta;updateOrientation();}
 else if(state.step==='dossier'){
  const p=state.reading[state.activeDossierTab];if(p){p.visibleMs=(p.visibleMs||0)+delta;updateReadingUI();}
 }else if(state.step==='replay'&&state.replay.mode==='text'){
  state.replay.textVisibleMs=(state.replay.textVisibleMs||0)+delta;checkNarrationEnd();
 }
 if(now-lastExposureSave>2000){lastExposureSave=now;saveDraft();}
}
