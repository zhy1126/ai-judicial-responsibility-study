/* Shared study rules. Assignment is local to this prototype, not verified identity. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '2.2.0';
  const RESPONSIBILITY_VERSION = 'independent-and-allocation-2026-09-16-v1';
  const MIN_READING_MS = 8000;
  const DOSSIER_TABS = ['overview','evidence','task'];
  const SCREENING_VERSION = 'four-choice-background-2026-09-20-v1';
  const SCREENING_CHOICES = [
    {id:'judge',label:'法官／法官助理'},
    {id:'legal_other',label:'其他法律相关人员（法学生、法务、法学研究人员等）'},
    {id:'lawyer',label:'律师'},
    {id:'other',label:'其他'},
  ];
  const ROLES = ['judge', 'lawyer', 'litigant', 'public'];
  const CONDITIONS = ['none', 'procedural', 'substantive', 'decisional'];
  const CASE_TYPES = ['natural', 'statutory'];
  const SCALE = ['完全不同意', '不同意', '比较不同意', '中立（既不赞同也不反对）', '比较同意', '同意', '完全同意'];
  const SUBJECTS = [
    {id:'judge',label:'承办法官／审判团队',description:'审阅案件、作出或审核裁判，并完成最终签署。'},
    {id:'court',label:'案件所在法院',description:'组织审判工作，并负责相关制度及技术使用的管理。'},
    {id:'provider',label:'AI 技术提供方',description:'开发、提供和维护 AI 系统的公司或团队。'},
    {id:'system',label:'AI 系统本身',description:'用于材料处理、分析或提供建议的软件系统。'},
  ];
  function choose(items) {
    const bytes = new Uint32Array(1);
    const limit = 4294967296 - (4294967296 % items.length);
    do { globalThis.crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
    return items[bytes[0] % items.length];
  }
  function validAssignment(a) {
    return Boolean(a && [VERSION,'2.1.0','2.0.0'].includes(a.version) && a.sessionId && ROLES.includes(a.role) && CONDITIONS.includes(a.condition) && CASE_TYPES.includes(a.caseType) && a.background);
  }
  function assignParticipant(background, options = {}) {
    const existing = validAssignment(options.existing) ? options.existing : null;
    if (existing && !options.rescreen) return existing;
    const choice = background?.backgroundChoice;
    if (choice) {
      const selected = SCREENING_CHOICES.find(item=>item.id===choice);
      if (!selected) throw new Error('请完成所有背景问题。');
      if (!options.sessionId) throw new Error('缺少实验编号。');
      const draw = options.choose || choose;
      const preview = options.preview;
      const role = preview && ROLES.includes(preview.role) ? preview.role : choice === 'judge' ? 'judge' : choice === 'lawyer' ? 'lawyer' : existing && ['litigant','public'].includes(existing.role) ? existing.role : draw(['litigant','public']);
      const facts = {backgroundChoice:choice,backgroundChoiceLabel:selected.label,legalIndustry:choice==='other'?'no':'yes',legalOccupation:choice==='judge'?'judge':choice==='lawyer'?'lawyer':choice==='legal_other'?'other':null,legalOccupationDetail:null,legalOccupationOther:null,judgeCaseExperience:null,judgeCaseExperienceStatus:'not_asked_four_choice',practicingLawyer:choice==='lawyer'?'yes':'no',licenseActive:null,legalDegree:null,litigationExperience:null,litigationExperienceStatus:'not_asked_four_choice'};
      return {version:VERSION,screeningVersion:SCREENING_VERSION,backgroundGroup:choice==='judge'?'judge':choice==='lawyer'?'lawyer':'public',sessionId:existing?.sessionId||options.sessionId,background:facts,role,condition:preview&&CONDITIONS.includes(preview.condition)?preview.condition:existing?.condition||draw(CONDITIONS),caseType:preview&&CASE_TYPES.includes(preview.caseType)?preview.caseType:existing?.caseType||draw(CASE_TYPES),roleAssignment:preview?'researcher_preview':choice==='lawyer'?'screened_lawyer':choice==='judge'?'screened_judge':'randomized_perspective',preview:Boolean(preview),assignedAt:new Date().toISOString()};
    }
    const yesNo = value => value === 'yes' || value === 'no';
    if (!background || !yesNo(background.legalIndustry) || !yesNo(background.legalDegree)) throw new Error('请完成所有背景问题。');
    const industry = background.legalIndustry === 'yes';
    const occupation = industry ? background.legalOccupation : null;
    if (industry && !['lawyer','judge','other'].includes(occupation)) throw new Error('请完成所有背景问题。');
    const detail = occupation === 'other' ? background.legalOccupationDetail : null;
    const other = detail === 'other' ? String(background.legalOccupationOther || '').trim() : null;
    if (occupation === 'other' && (!['corporate','judge_assistant','court_support','prosecution','lawyer_assistant','academic','other'].includes(detail) || (detail === 'other' && (!other || other.length > 80)))) throw new Error('请完成所有背景问题。');
    const lawyerBranch = occupation === 'lawyer';
    const currentJudicial = occupation === 'judge' || detail === 'judge_assistant';
    if (!lawyerBranch && !currentJudicial && (!yesNo(background.judgeCaseExperience) || (background.judgeCaseExperience === 'no' && !yesNo(background.litigationExperience)))) throw new Error('请完成所有背景问题。');
    if (!options.sessionId) throw new Error('缺少实验编号。');
    const draw = options.choose || choose;
    const judgeBranch = currentJudicial || (!lawyerBranch && background.judgeCaseExperience === 'yes');
    const facts = {legalIndustry:background.legalIndustry,legalOccupation:occupation,legalOccupationDetail:detail,legalOccupationOther:other,judgeCaseExperience:lawyerBranch || currentJudicial ? null : background.judgeCaseExperience, judgeCaseExperienceStatus:lawyerBranch ? 'not_asked_lawyer_branch' : currentJudicial ? 'not_asked_current_judicial_branch' : 'answered', practicingLawyer:lawyerBranch ? 'yes' : 'no', legalDegree:background.legalDegree,
      licenseActive:null,
      litigationExperience:lawyerBranch || judgeBranch ? null : background.litigationExperience,
      litigationExperienceStatus:lawyerBranch ? 'not_asked_lawyer_branch' : judgeBranch ? 'not_asked_judge_branch' : 'answered'};
    const lawyer = facts.practicingLawyer === 'yes';
    const preview = options.preview;
    return {
      version: VERSION, screeningVersion:SCREENING_VERSION, backgroundGroup:lawyer ? 'lawyer' : judgeBranch ? 'judge' : 'public', sessionId: existing?.sessionId || options.sessionId, background: facts,
      role: preview && ROLES.includes(preview.role) ? preview.role : lawyer ? 'lawyer' : judgeBranch ? 'judge' : existing && ['litigant','public'].includes(existing.role) ? existing.role : draw(['litigant','public']),
      condition: preview && CONDITIONS.includes(preview.condition) ? preview.condition : existing?.condition || draw(CONDITIONS),
      caseType: preview && CASE_TYPES.includes(preview.caseType) ? preview.caseType : existing?.caseType || draw(CASE_TYPES),
      roleAssignment: preview ? 'researcher_preview' : lawyer ? 'screened_lawyer' : judgeBranch ? 'screened_judge' : 'randomized_perspective',
      preview: Boolean(preview), assignedAt: new Date().toISOString(),
    };
  }
  function subjectsFor(condition) { return [...SUBJECTS]; }
  function readingComplete(progress) { return DOSSIER_TABS.every(tab=>progress?.[tab]?.reachedEnd === true && progress[tab].confirmed === true && progress[tab].visibleMs >= MIN_READING_MS); }
  function validRanking(ids, condition) {
    const expected = subjectsFor(condition).map(x=>x.id);
    return Array.isArray(ids) && ids.length === expected.length && new Set(ids).size === expected.length && ids.every(id=>expected.includes(id));
  }
  function shuffle(items) {
    const result=[...items];
    for (let i=result.length-1;i>0;i--) { const j=choose(Array.from({length:i+1},(_,n)=>n)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  }
  function ratingValue(raw, applicable = true) {
    if (!applicable) return {value:null,status:'not_applicable'};
    if (raw === 'unsure') return {value:null,status:'unsure'};
    if (!/^[1-7]$/.test(String(raw))) throw new Error('请完成所有适用的感受题。');
    return {value:Number(raw),status:'answered'};
  }
  function responsibilityValues(raw, allocation = false) {
    const ids = SUBJECTS.map(subject=>subject.id);
    if (!raw || Array.isArray(raw) || Object.keys(raw).length !== ids.length || !ids.every(id=>Object.hasOwn(raw,id))) throw new Error('请填写四个责任主体的分值。');
    const values = {};
    for (const id of ids) {
      const value = raw[id];
      if (!((typeof value === 'number' && Number.isInteger(value)) || (typeof value === 'string' && /^\d{1,3}$/.test(value))) || Number(value)<0 || Number(value)>100) throw new Error('每个主体都需填写 0–100 的整数；没有责任请填 0。');
      values[id] = Number(value);
    }
    if (allocation && Object.values(values).reduce((sum,value)=>sum+value,0)!==100) throw new Error('责任分配必须合计 100 分。');
    return values;
  }
  return {VERSION,SCREENING_VERSION,SCREENING_CHOICES,RESPONSIBILITY_VERSION,MIN_READING_MS,DOSSIER_TABS,ROLES,CONDITIONS,CASE_TYPES,SCALE,SUBJECTS,choose,shuffle,validAssignment,assignParticipant,readingComplete,subjectsFor,validRanking,ratingValue,responsibilityValues};
});
