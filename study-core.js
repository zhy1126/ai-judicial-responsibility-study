/* Shared study rules. Assignment is local to this prototype, not verified identity. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '2.0.0';
  const ROLES = ['lawyer', 'litigant', 'public'];
  const CONDITIONS = ['none', 'procedural', 'substantive', 'decisional'];
  const CASE_TYPES = ['natural', 'statutory'];
  const SCALE = ['完全不同意', '不同意', '比较不同意', '中立（既不赞同也不反对）', '比较同意', '同意', '完全同意'];
  const SUBJECTS = [
    {id:'judge',label:'承办法官／审判团队',description:'审阅案件、作出或审核裁判，并完成最终签署。'},
    {id:'court',label:'案件所在法院',description:'组织审判工作，并负责相关制度及技术使用的管理。'},
    {id:'provider',label:'AI 技术提供方',description:'开发、提供和维护本案使用的系统的公司或团队。'},
    {id:'system',label:'AI 系统本身',description:'实际执行材料处理、分析或提出建议的软件系统。'},
  ];
  function choose(items) {
    const bytes = new Uint32Array(1);
    const limit = 4294967296 - (4294967296 % items.length);
    do { globalThis.crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
    return items[bytes[0] % items.length];
  }
  function validAssignment(a) {
    return Boolean(a && a.version === VERSION && a.sessionId && ROLES.includes(a.role) && CONDITIONS.includes(a.condition) && CASE_TYPES.includes(a.caseType) && a.background);
  }
  function assignParticipant(background, options = {}) {
    if (validAssignment(options.existing)) return options.existing;
    const yesNo = value => value === 'yes' || value === 'no';
    if (!background || !['practicingLawyer','legalEducation','litigationExperience'].every(k => yesNo(background[k])) || (background.practicingLawyer === 'yes' && !yesNo(background.licenseActive))) {
      throw new Error('请完成所有背景是非题。');
    }
    if (!options.sessionId) throw new Error('缺少体验编号。');
    const draw = options.choose || choose;
    const facts = {...background, licenseActive: background.practicingLawyer === 'yes' ? background.licenseActive : null};
    const lawyer = facts.practicingLawyer === 'yes' && facts.licenseActive === 'yes';
    const preview = options.preview;
    return {
      version: VERSION, sessionId: options.sessionId, background: facts,
      role: preview && ROLES.includes(preview.role) ? preview.role : lawyer ? 'lawyer' : draw(['litigant','public']),
      condition: preview && CONDITIONS.includes(preview.condition) ? preview.condition : draw(CONDITIONS),
      caseType: preview && CASE_TYPES.includes(preview.caseType) ? preview.caseType : draw(CASE_TYPES),
      roleAssignment: preview ? 'researcher_preview' : lawyer ? 'screened_lawyer' : 'randomized_perspective',
      preview: Boolean(preview), assignedAt: new Date().toISOString(),
    };
  }
  function subjectsFor(condition) { return SUBJECTS.filter(x => condition !== 'none' || ['judge','court'].includes(x.id)); }
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
  return {VERSION,ROLES,CONDITIONS,CASE_TYPES,SCALE,SUBJECTS,choose,shuffle,validAssignment,assignParticipant,subjectsFor,validRanking,ratingValue};
});
