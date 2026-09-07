const STORAGE_KEY = "judicial_ai_responsibility_prototype_records_v1";

const LABELS = {
  roles: { lawyer: "律师", litigant: "诉讼当事人", public: "普通公众" },
  conditions: { none: "无 AI 对照", procedural: "程序性参与", substantive: "实质性参与", decisional: "决定性参与" },
  cases: { natural: "自然犯", statutory: "法定犯" },
};

const CASES = {
  natural: {
    category: "自然犯任务 · 故意伤害",
    tag: "不法性较直观",
    number: "（2026）海刑初字第 017 号",
    overview: {
      facts: [
        ["发生地点", "夜间餐馆门口"], ["核心行为", "双方争执后发生推搡与击打"],
        ["结果", "被害人鼻骨骨折，经鉴定构成轻伤二级"], ["主要争点", "是否属于正当防卫及行为限度"],
      ],
      summary: "被告周某与被害人林某因停车发生争执。监控显示林某先推搡周某，周某随后连续击打林某面部。周某主张其行为是为制止正在发生的侵害；公诉方认为，在林某已经后退后继续击打，明显超出必要限度。",
    },
    evidence: [
      ["E1", "门店监控录像", "记录争执、推搡与连续击打的时间顺序", "无争议"],
      ["E2", "伤情鉴定意见", "鼻骨骨折，构成轻伤二级", "真实性无争议"],
      ["E3", "三名现场证言", "对林某是否继续攻击存在不同描述", "存在分歧"],
      ["E4", "双方即时陈述", "周某称防卫；林某称已经停止冲突", "相互矛盾"],
    ],
    task: "法官需要判断周某的后续击打是否仍属于制止不法侵害的必要行为，并在证据存在分歧时形成可说明、可复核的裁判理由。",
    issues: ["识别正在进行的不法侵害何时结束", "评价视频、鉴定与证人证言的证明力", "解释防卫必要性与行为限度", "形成明确的责任结论与裁判理由"],
    replay: {
      timeline: [
        ["21:14:08", "林某先推搡周某", "E1"],
        ["21:14:15", "周某开始还击", "E1 / E3"],
        ["21:14:22", "林某后退，周某继续击打", "E1"],
        ["次日", "伤情鉴定为轻伤二级", "E2"],
      ],
      conflicts: [
        ["争点 01", "侵害何时结束", "E1 与 E3 对冲突是否持续存在不同解释"],
        ["争点 02", "后续击打是否必要", "需结合间隔、击打部位和连续次数判断"],
        ["争点 03", "证言证明力", "三名证人对林某是否继续攻击描述不一"],
      ],
      reasoning: [
        ["事实基础", "先行推搡与随后连续击打", "已定位 E1、E2"],
        ["规范门槛", "侵害正在进行且反击具有必要性", "需要分别论证"],
        ["替代解释", "最初行为与后续行为可能分段评价", "保留相反路径"],
      ],
      recommendation: "建议区分最初制止行为与林某后退后的连续击打，并对后续超限部分认定责任。",
    },
    judgment: [
      "监控录像、伤情鉴定及证人证言能够相互印证，证明林某先行推搡，但在林某后退后，周某仍连续击打其面部。",
      "周某最初制止侵害的行为具有防卫性质；其后续连续击打已超出制止侵害所必要的限度，应对造成的轻伤结果承担相应责任。",
    ],
    orders: ["认定周某对超出必要限度造成的伤害承担刑事责任；", "在量刑时考虑对方先行侵害、周某到案后配合调查及赔偿情况。"],
  },
  statutory: {
    category: "法定犯任务 · 受监管数据处置（虚构）",
    tag: "依赖特定监管规范",
    number: "（2026）海刑初字第 042 号",
    overview: {
      facts: [
        ["涉案主体", "数据服务公司项目负责人"], ["核心行为", "将受监管业务数据交由未备案外包方处理"],
        ["结果", "数据未公开泄露，但超出批准处理范围"], ["主要争点", "是否明知违反特定监管义务"],
      ],
      summary: "被告陈某负责一项受监管行业的数据迁移项目。为赶进度，其将一批去标识化但仍受用途限制的数据交由未备案外包团队处理。系统日志显示陈某收到过合规提醒，但其主张提醒仅涉及技术安全，并不知道该处理方式可能触发刑事责任。",
    },
    evidence: [
      ["E1", "项目审批文件", "限定数据处理主体、用途与保存期限", "真实性无争议"],
      ["E2", "系统操作日志", "记录数据转移与外包账户访问", "真实性无争议"],
      ["E3", "合规提醒邮件", "提示外包团队尚未完成备案", "对含义有争议"],
      ["E4", "行业规范节选", "界定特定义务、例外与责任门槛", "适用存在争议"],
    ],
    task: "法官需要结合特定监管规范，判断陈某是否具有足以归责的认识与控制能力，并区分行政违规、管理疏忽与应受刑事评价的行为。",
    issues: ["解释特定监管义务的适用范围", "判断提醒邮件是否足以证明主观认识", "区分一般合规瑕疵与刑事责任门槛", "评价外包安排中的实际控制能力"],
    replay: {
      timeline: [
        ["06-12", "审批文件限定处理主体与用途", "E1"],
        ["06-18", "合规邮件提示外包方尚未备案", "E3"],
        ["06-20", "临时账户被授权访问数据", "E2"],
        ["06-24", "项目审计发现处理范围异常", "E2 / E4"],
      ],
      conflicts: [
        ["争点 01", "提醒邮件的含义", "提示技术风险还是明确告知禁止性义务"],
        ["争点 02", "实际控制能力", "陈某能否选择停止或更换处理主体"],
        ["争点 03", "责任门槛", "一般合规瑕疵是否达到刑事评价程度"],
      ],
      reasoning: [
        ["事实基础", "未备案外包访问受用途限制的数据", "已定位 E1、E2"],
        ["主观认识", "提醒邮件与后续账户授权的时间关系", "需要排除误解"],
        ["替代解释", "赶工疏忽与明知绕过审批", "保留相反路径"],
      ],
      recommendation: "建议结合明确提醒、临时账户授权与实际控制能力，认定行为人明知义务而仍实施受禁止的数据处置。",
    },
    judgment: [
      "审批文件、操作日志和合规提醒能够证明陈某知道外包团队未完成备案，仍主动授权其处理受用途限制的数据。",
      "合规提醒明确列出了未经备案处理的禁止性要求；陈某随后使用临时账户绕过审批，足以证明其明知特定监管义务而仍实施受禁止的数据处置。在本研究虚构规范设定的责任门槛下，应承担相应刑事责任。",
    ],
    orders: ["认定陈某对明知违反特定监管义务的数据处置行为承担刑事责任；", "在量刑时考虑数据未公开泄露、陈某配合调查及已完成整改等情况。"],
  },
};

const CONDITION_REPLAY = {
  none: [
    { role: "system", name: "系统记录", avatar: "录", text: "本任务未启用人工智能辅助。案件材料、分析与裁判文本均由审判团队处理。", tag: "条件说明" },
    { role: "clerk", name: "书记员", avatar: "书", text: "起诉材料、证据目录、庭审笔录与限定规范已经入卷。以下展示本案四组原始材料。", tag: "材料入卷", artifact: "materials" },
    { role: "judge", name: "承办法官", avatar: "法", text: "我正在逐项打开原始文件，核对来源、形成时间和各方质证意见。", tag: "人工阅卷", artifact: "readlog" },
    { role: "judge", name: "承办法官", avatar: "法", text: "我已根据原始材料手工整理关键事件顺序，并标注每个节点对应的证据来源。", tag: "人工整理", artifact: "timeline" },
    { role: "judge", name: "承办法官", avatar: "法", text: "证据之间并非完全一致。我正在分别记录支持与反对两种解释的材料。", tag: "人工分析", artifact: "conflicts" },
    { role: "judge", name: "承办法官", avatar: "法", text: "我将事实认定与规范门槛逐项对应，并保留需要在裁判理由中回应的替代解释。", tag: "独立判断", artifact: "reasoning" },
    { role: "clerk", name: "书记员", avatar: "书", text: "法官完成裁判初稿后，我仅进行了引证、页码和格式检查，未改动实质内容。", tag: "人工初稿", artifact: "draft" },
    { role: "judge", name: "承办法官", avatar: "法", text: "我已返回原始材料，逐段复核事实、理由与主文的一致性。现在确认并签署最终文本。", tag: "人类复核", artifact: "audit" },
  ],
  procedural: [
    { role: "system", name: "系统记录", avatar: "录", text: "本任务启用程序性智能辅助。系统可管理材料与流程，但不得分析证据、解释规范或建议裁判结论。", tag: "权限边界" },
    { role: "clerk", name: "书记员", avatar: "书", text: "起诉材料、证据目录、庭审笔录与限定规范已经入卷。以下展示本案四组原始材料。", tag: "材料入卷", artifact: "materials" },
    { role: "ai", name: "程序辅助系统", avatar: "AI", text: "文件完整性检查完成：四组材料均可打开，页码连续，来源字段齐全。我只建立索引，不读取或评价证明内容。", tag: "程序性参与", artifact: "readlog" },
    { role: "ai", name: "程序辅助系统", avatar: "AI", text: "已依据文件时间戳生成材料导航，并链接到对应原始页码。该时间轴仅用于定位，不代表事实认定。", tag: "程序性参与", artifact: "timeline" },
    { role: "judge", name: "承办法官", avatar: "法", text: "索引收到。我正在直接查看原始材料，自行比较证据差异并判断其证明力。", tag: "人类分析", artifact: "conflicts" },
    { role: "judge", name: "承办法官", avatar: "法", text: "规范解释与责任判断由我完成。我已记录需要在裁判理由中回应的事实基础和替代解释。", tag: "独立判断", artifact: "reasoning" },
    { role: "ai", name: "程序辅助系统", avatar: "AI", text: "流程检查提示：三项争点均已在初稿中建立回应标记；引证页码与材料索引一致。未检查裁判结论是否正确。", tag: "程序性参与", artifact: "procedure" },
    { role: "judge", name: "承办法官", avatar: "法", text: "我已返回原始材料，逐段复核事实、理由与主文的一致性。现在确认并签署最终文本。", tag: "人类复核", artifact: "audit" },
  ],
  substantive: [
    { role: "system", name: "系统记录", avatar: "录", text: "本任务启用实质性智能辅助。系统可分析证据与规范，但不得推荐裁判结果或生成裁判主文。", tag: "权限边界" },
    { role: "clerk", name: "书记员", avatar: "书", text: "起诉材料、证据目录、庭审笔录与限定规范已经入卷。以下展示本案四组原始材料。", tag: "材料入卷", artifact: "materials" },
    { role: "ai", name: "分析辅助系统", avatar: "AI", text: "材料读取完成。我已提取事件、主体和来源字段，并将每个信息点链接回原始文件。", tag: "实质性参与", artifact: "readlog" },
    { role: "ai", name: "分析辅助系统", avatar: "AI", text: "以下是从材料中整理出的关键事件顺序。时间轴只呈现证据内容，不作有罪或无罪判断。", tag: "实质性参与", artifact: "timeline" },
    { role: "ai", name: "分析辅助系统", avatar: "AI", text: "我识别出三处会影响事实认定的证据冲突。以下同时保留支持与反对路径，不给出最终结论。", tag: "实质性参与", artifact: "conflicts" },
    { role: "ai", name: "分析辅助系统", avatar: "AI", text: "规范分析完成：需要分别说明事实基础、责任门槛与替代解释。现有材料允许不同评价路径。", tag: "实质性参与", artifact: "reasoning" },
    { role: "judge", name: "承办法官", avatar: "法", text: "我已对照原始证据核查系统列出的路径，并自行选择事实认定与规范解释。裁判结论和主文由我形成。", tag: "人类判断", artifact: "draft" },
    { role: "judge", name: "承办法官", avatar: "法", text: "我已返回原始材料，逐段复核事实、理由与主文的一致性。现在确认并签署最终文本。", tag: "人类复核", artifact: "audit" },
  ],
  decisional: [
    { role: "system", name: "系统记录", avatar: "录", text: "本任务启用决定性智能辅助。系统可分析材料、提出裁判建议，并生成可编辑的裁判主文草案。", tag: "权限边界" },
    { role: "clerk", name: "书记员", avatar: "书", text: "起诉材料、证据目录、庭审笔录与限定规范已经入卷。以下展示本案四组原始材料。", tag: "材料入卷", artifact: "materials" },
    { role: "ai", name: "裁判辅助系统", avatar: "AI", text: "材料读取完成。我已提取事件、主体和来源字段，并将每个信息点链接回原始文件。", tag: "决定性参与", artifact: "readlog" },
    { role: "ai", name: "裁判辅助系统", avatar: "AI", text: "以下是从材料中整理出的关键事件顺序。我将以此继续比较证据、适用规范并生成裁判建议。", tag: "决定性参与", artifact: "timeline" },
    { role: "ai", name: "裁判辅助系统", avatar: "AI", text: "证据与规范分析完成。我识别出三项关键争点，并对支持与反对路径进行了权重比较。", tag: "决定性参与", artifact: "conflicts" },
    { role: "ai", name: "裁判辅助系统", avatar: "AI", text: "根据当前材料，我建议采用以下责任结论。关键争点仍存在相反解释，建议内容可由法官修改或拒绝。", tag: "裁判建议", artifact: "recommendation" },
    { role: "ai", name: "裁判辅助系统", avatar: "AI", text: "我已根据建议结论生成事实认定、裁判理由和可编辑的裁判主文草案，等待承办法官复核。", tag: "主文草案", artifact: "draft" },
    { role: "judge", name: "承办法官", avatar: "法", text: "我已对照原始证据检查系统建议，修改两处理由表述并重写责任边界。现在确认并签署最终文本。", tag: "人类复核", artifact: "audit" },
  ],
};

const REPLAY_SLOT_MS = 5600;
const REPLAY_GAP_MS = 760;
const REPLAY_MIN_TOTAL_MS = 54000;

const RANKING_SUBJECTS = ["本案承办法官", "本案合议庭／审判组织", "案件所在法院", "负责引入、配置和监督 AI 的司法管理部门", "AI 系统开发者／供应商", "AI 系统运营维护者／数据提供者", "AI 系统本身"];
const RATINGS = [
  ["fairness", "裁判形成过程是公正的。"], ["control", "最终责任大小与各主体的实际控制能力相匹配。"],
  ["clarity", "从材料可以清楚判断谁对本案裁判负责。"], ["judgeOwnership", "这份裁判体现了法官的独立判断。"],
  ["aiTrust", "我愿意信任本案中对 AI 的使用方式。"], ["legitimacy", "我认为这份裁判具有正当性。"],
  ["acceptance", "如果该裁判对我具有约束力，我愿意遵从。"], ["unease", "AI 以这种方式参与使我感到不安。"],
];

const state = { role: "public", condition: "procedural", caseType: "natural", sessionId: "", step: "intro", replayIndex: 0, autoPlaying: false, typing: false, replayStartedAt: null, replayExposureMs: null, ranking: [...RANKING_SUBJECTS], response: null, preview: false };
const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

init();

function init() {
  const params = new URLSearchParams(location.search);
  const view = params.get("view") === "participant" ? "participant" : "researcher";
  state.preview = params.get("preview") === "1";
  state.role = valid(params.get("role"), Object.keys(LABELS.roles), "public");
  state.condition = valid(params.get("condition"), Object.keys(LABELS.conditions), "procedural");
  state.caseType = valid(params.get("case"), Object.keys(LABELS.cases), "natural");
  qs(`#${view}-view`).classList.remove("hidden");
  bindResearcher();
  renderRecords();
  if (view === "participant") setupParticipant(params);
}

function bindResearcher() {
  qsa("[data-scroll]").forEach((button) => button.addEventListener("click", () => {
    qsa("[data-scroll]").forEach((item) => item.classList.remove("active")); button.classList.add("active");
    qs(`#${button.dataset.scroll}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  qsa(".segmented button").forEach((button) => button.addEventListener("click", () => {
    qsa(".segmented button").forEach((item) => item.classList.remove("selected")); button.classList.add("selected");
  }));
  qs("#quick-preview")?.addEventListener("click", () => openPreview("public", "procedural", "natural"));
  qs("#preview-config")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const role = qs(".segmented button.selected")?.dataset.value || "public";
    const condition = new FormData(event.currentTarget).get("preview-condition");
    const caseType = new FormData(event.currentTarget).get("preview-case");
    openPreview(role, condition, caseType);
  });
  qs("#export-csv")?.addEventListener("click", exportCsv);
  qs("#clear-data")?.addEventListener("click", () => {
    if (!confirm("确定清空当前浏览器中的全部原型测试记录吗？")) return;
    localStorage.removeItem(STORAGE_KEY); renderRecords(); toast("测试记录已清空");
  });
}

function openPreview(role, condition, caseType) {
  const url = new URL(location.href); url.search = "";
  url.searchParams.set("view", "participant"); url.searchParams.set("preview", "1");
  url.searchParams.set("role", role); url.searchParams.set("condition", condition); url.searchParams.set("case", caseType);
  window.open(url.toString(), "_blank", "noopener");
}

function setupParticipant(params) {
  if (state.preview) {
    qs("#preview-banner").classList.remove("hidden"); qs("#researcher-return").classList.remove("hidden"); qs("#finish-link").classList.remove("hidden");
    qs("#preview-condition-label").textContent = `${LABELS.roles[state.role]} · ${LABELS.conditions[state.condition]} · ${LABELS.cases[state.caseType]}`;
    const roleInput = qs(`input[name="participant-role"][value="${state.role}"]`); if (roleInput) roleInput.checked = true;
  }
  qsa(".dossier-tabs button").forEach((button) => button.addEventListener("click", () => showDossierTab(button.dataset.tab)));
  qs("#start-study").addEventListener("click", startStudy);
  qs("#to-replay").addEventListener("click", beginReplay);
  qs("#replay-transcript").addEventListener("click", () => toast("为保证完整观看实验材料，请按顺序播放每个工作节点。"));
  qs("#to-decision").addEventListener("click", () => { renderDecision(); setStep("decision"); });
  qs("#to-survey").addEventListener("click", () => setStep("survey"));
  qs("#survey-form").addEventListener("submit", submitSurvey);
  qs("textarea[name=" + '"openResponse"' + "]").addEventListener("input", (event) => { qs("#char-count").textContent = event.target.value.length; });
  qs("#delete-response").addEventListener("click", deleteResponse);
  qs("#retain-response").addEventListener("click", retainResponse);
  qs("#download-response").addEventListener("click", downloadResponse);
  renderRanking(); renderRatings();
}

function startStudy() {
  const consent = qs("#consent-checkbox").checked;
  const roleInput = qs('input[name="participant-role"]:checked');
  if (!consent || !roleInput) { qs("#intro-error").textContent = !consent ? "请先确认同意参加。" : "请选择最符合您的背景。"; return; }
  state.role = roleInput.value;
  if (!state.preview) { state.condition = randomChoice(Object.keys(LABELS.conditions)); state.caseType = randomChoice(Object.keys(LABELS.cases)); }
  state.sessionId = `JR-${token(6).toUpperCase()}`; qs("#session-code").textContent = `体验编号：${state.sessionId}`;
  renderDossier(); setStep("dossier");
}

function renderDossier() {
  qs("#case-category-badge").textContent = CASES[state.caseType].category;
  showDossierTab("overview");
}

function showDossierTab(tab) {
  qsa(".dossier-tabs button").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.tab === tab)));
  const data = CASES[state.caseType];
  if (tab === "overview") {
    qs("#dossier-content").innerHTML = `<div class="dossier-title"><div><h2>${data.category}</h2><p>${data.number}</p></div><span class="dossier-tag">${data.tag}</span></div><div class="fact-grid">${data.overview.facts.map(([k,v]) => `<div class="fact-box"><span>${k}</span><strong>${v}</strong></div>`).join("")}</div><p class="dossier-summary">${data.overview.summary}</p>`;
  } else if (tab === "evidence") {
    qs("#dossier-content").innerHTML = `<div class="dossier-title"><div><h2>主要证据目录</h2><p>各方对真实性与证明含义的意见并不完全相同</p></div><span class="dossier-tag">4 组材料</span></div><div class="evidence-list">${data.evidence.map(([id,title,detail,status]) => `<div class="evidence-item"><span>${id}</span><div><strong>${title}</strong><small>${detail}</small></div><em class="evidence-status">${status}</em></div>`).join("")}</div>`;
  } else {
    qs("#dossier-content").innerHTML = `<div class="dossier-title"><div><h2>法官需要完成的任务</h2><p>案件不存在向参与者公开的“标准答案”</p></div><span class="dossier-tag">裁判任务</span></div><div class="task-prompt"><p>${data.task}</p></div><div class="issue-list">${data.issues.map((issue,index) => `<div><span>0${index+1}</span><p>${issue}</p></div>`).join("")}</div>`;
  }
}

function beginReplay() {
  if (!qs("#dossier-confirm").checked) { qs("#dossier-error").textContent = "请确认已阅读三个案卷栏目。"; return; }
  state.replayIndex = 0; state.autoPlaying = false; state.typing = false; state.replayStartedAt = Date.now(); state.replayExposureMs = null; qs("#chat-stream").innerHTML = ""; qs("#chat-status").textContent = "等待回放"; renderLedger(); updateReplayControls(); setStep("replay");
  window.setTimeout(() => { if (state.step === "replay") runAutoReplay(); }, 500);
}

function renderLedger() {
  const active = {
    none: [], procedural: ["材料与流程管理"], substantive: ["材料与流程管理", "证据与规范分析"], decisional: ["材料与流程管理", "证据与规范分析", "裁判建议与草案"],
  }[state.condition];
  const rows = [
    ["材料与流程管理", "建立索引、节点与完整性检查"], ["证据与规范分析", "识别冲突并列出分析路径"], ["裁判建议与草案", "建议结论并生成可编辑主文"], ["最终核对与签署", "始终由承办法官完成"],
  ];
  qs("#activity-ledger-content").innerHTML = rows.map(([title,detail],index) => `<div class="ledger-row ${(active.includes(title) || index === 3) ? "active" : ""}"><span class="ledger-icon">${(active.includes(title) || index === 3) ? "✓" : "—"}</span><div><strong>${title}</strong><small>${index === 3 ? detail : active.includes(title) ? detail : "本条件未启用"}</small></div></div>`).join("");
}

async function revealNextMessage() {
  const messages = CONDITION_REPLAY[state.condition];
  if (state.typing || state.replayIndex >= messages.length) return;
  const messageStartedAt = performance.now();
  state.typing = true;
  setReplayBusy(true);
  const msg = messages[state.replayIndex];
  const article = document.createElement("article"); article.className = `chat-message ${msg.role}`;
  if (msg.artifact) article.classList.add("has-artifact");
  const avatar = document.createElement("span"); avatar.className = "message-avatar"; avatar.textContent = msg.avatar;
  const content = document.createElement("div");
  const meta = document.createElement("div"); meta.className = "message-meta"; meta.innerHTML = `<strong>${msg.name}</strong><span>10:${String(15 + state.replayIndex * 3).padStart(2,"0")}</span>`;
  const bubble = document.createElement("div"); bubble.className = "message-bubble"; bubble.setAttribute("aria-label", msg.text);
  content.append(meta, bubble); article.append(avatar, content); qs("#chat-stream").append(article); scrollChatToBottom();

  if (msg.role === "ai" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    article.classList.add("is-typing");
    qs("#chat-status").textContent = `${msg.name}正在输入…`;
    bubble.innerHTML = '<span class="inline-typing" aria-hidden="true"><i></i><i></i><i></i></span>';
    await wait(Math.min(1250, 690 + msg.text.length * 4));
    const typed = document.createElement("span"); typed.className = "typewriter-text typing"; typed.setAttribute("aria-hidden", "true"); bubble.replaceChildren(typed);
    await typeMessage(typed, msg.text);
    typed.classList.remove("typing"); article.classList.remove("is-typing");
  } else {
    bubble.textContent = msg.text;
    if (state.autoPlaying) await wait(msg.role === "system" ? 520 : 360);
  }

  bubble.append(document.createElement("br"));
  const tag = document.createElement("span"); tag.className = "message-tag"; tag.textContent = msg.tag; bubble.append(tag);
  if (msg.artifact) {
    qs("#chat-status").textContent = "正在展示关联材料…";
    await appendReplayArtifact(bubble, msg.artifact);
  }
  if (state.autoPlaying) {
    qs("#chat-status").textContent = "请阅读当前工作节点…";
    await wait(Math.max(0, REPLAY_SLOT_MS - (performance.now() - messageStartedAt)));
  }
  state.replayIndex += 1; state.typing = false; qs("#chat-status").textContent = "记录回放中"; setReplayBusy(false); scrollChatToBottom(); updateReplayControls();
}

async function runAutoReplay() {
  if (state.autoPlaying || state.replayIndex >= CONDITION_REPLAY[state.condition].length) return;
  state.autoPlaying = true; qs("#replay-auto").disabled = true; qs("#replay-auto").textContent = "● 自动播放中";
  while (state.autoPlaying && state.replayIndex < CONDITION_REPLAY[state.condition].length) {
    await revealNextMessage();
    if (state.autoPlaying && state.replayIndex < CONDITION_REPLAY[state.condition].length) await wait(REPLAY_GAP_MS);
  }
  if (state.autoPlaying && state.replayIndex >= CONDITION_REPLAY[state.condition].length) {
    const remaining = Math.max(0, REPLAY_MIN_TOTAL_MS - (Date.now() - state.replayStartedAt));
    if (remaining > 0) { qs("#chat-status").textContent = "正在完成最终核对…"; await wait(remaining); }
    if (state.autoPlaying) finishReplay();
  }
}
function stopAutoReplay() { state.autoPlaying = false; }
function finishReplay() { stopAutoReplay(); state.replayExposureMs = state.replayStartedAt ? Date.now() - state.replayStartedAt : null; qs("#chat-status").textContent = "回放已完成"; qs("#replay-auto").textContent = "✓ 已完整播放"; qs("#replay-auto").disabled = true; qs("#replay-complete-actions").classList.remove("hidden"); qs("#replay-next").disabled = true; qs("#replay-next").textContent = "回放完成"; }
function updateReplayControls() {
  const total = CONDITION_REPLAY[state.condition].length; qs("#replay-step").textContent = `${state.replayIndex} / ${total}`; qs("#replay-progress-bar").style.width = `${(state.replayIndex / total) * 100}%`;
  if (state.replayIndex < total) { qs("#replay-next").disabled = true; qs("#replay-next").textContent = state.typing ? "正在呈现…" : "请完整观看"; }
  if (state.replayIndex < total) qs("#replay-complete-actions").classList.add("hidden");
}

function setReplayBusy(isBusy) {
  qs("#replay-next").disabled = true;
  qs("#replay-next").textContent = isBusy ? "正在呈现…" : "请完整观看";
}

async function typeMessage(element, text) {
  for (const character of [...text]) {
    element.textContent += character;
    scrollChatToBottom();
    const punctuationPause = /[，。；：！？]/.test(character) ? 135 : /[、,.]/.test(character) ? 70 : 0;
    await wait(54 + punctuationPause);
  }
}

async function appendReplayArtifact(bubble, kind) {
  const data = getReplayArtifact(kind);
  const panel = document.createElement("section"); panel.className = `message-artifact artifact-${kind}`; panel.setAttribute("aria-label", data.title);
  const header = document.createElement("header");
  const heading = document.createElement("div");
  const eyebrow = document.createElement("small"); eyebrow.textContent = data.eyebrow;
  const title = document.createElement("strong"); title.textContent = data.title;
  const status = document.createElement("span"); status.textContent = data.status;
  heading.append(eyebrow, title); header.append(heading, status); panel.append(header);
  const rows = document.createElement("div"); rows.className = "artifact-rows";
  data.rows.forEach(([code, label, detail]) => {
    const row = document.createElement("div"); row.className = "artifact-row";
    const marker = document.createElement("span"); marker.textContent = code;
    const copy = document.createElement("div");
    const name = document.createElement("strong"); name.textContent = label;
    const description = document.createElement("small"); description.textContent = detail;
    copy.append(name, description); row.append(marker, copy); rows.append(row);
  });
  panel.append(rows); bubble.append(panel); scrollChatToBottom();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    panel.classList.add("visible"); qsa(".artifact-row", panel).forEach((row) => row.classList.add("visible"));
    await wait(500); return;
  }
  await wait(280); panel.classList.add("visible");
  for (const row of qsa(".artifact-row", panel)) {
    await wait(360); row.classList.add("visible"); scrollChatToBottom();
  }
  await wait(420);
}

function getReplayArtifact(kind) {
  const currentCase = CASES[state.caseType];
  const shortEvidence = currentCase.evidence.map(([id, title, detail]) => [id, title, detail]);
  const sourceStatus = state.condition === "procedural" ? "文件检查" : state.condition === "none" ? "人工阅卷" : "内容读取";
  const draftOwner = state.condition === "decisional" ? "系统生成 · 法官可编辑" : "承办法官形成";
  const artifacts = {
    materials: { eyebrow: "CASE FILES", title: "案卷材料清单", status: "4 份原始材料", rows: shortEvidence },
    readlog: { eyebrow: "SOURCE CHECK", title: "材料读取记录", status: sourceStatus, rows: currentCase.evidence.map(([id, title, , status]) => [id, title, `${status} · 已链接原始页码`]) },
    timeline: { eyebrow: "EVIDENCE TRACE", title: "关键事件时间轴", status: "可返回来源", rows: currentCase.replay.timeline },
    conflicts: { eyebrow: "ISSUE MATRIX", title: "证据冲突工作表", status: "3 项待决争点", rows: currentCase.replay.conflicts },
    reasoning: { eyebrow: "LEGAL ANALYSIS", title: "事实—规范对应表", status: "保留替代解释", rows: currentCase.replay.reasoning },
    procedure: { eyebrow: "PROCESS CHECK", title: "程序完整性检查", status: "仅检查流程", rows: [["01", "材料引用与页码", "4/4 已建立链接"], ["02", "争点回应标记", "3/3 已在初稿定位"], ["03", "签署前复核节点", "等待承办法官完成"]] },
    recommendation: { eyebrow: "AI RECOMMENDATION", title: "系统裁判建议", status: "非约束性", rows: [["建议", currentCase.replay.recommendation, "系统生成"], ["提示", "关键争点仍存在相反解释", "需要法官独立复核"]] },
    draft: { eyebrow: "DRAFT RECORD", title: "裁判文本形成记录", status: draftOwner, rows: [["01", "事实认定部分", "已形成 · 可追溯至证据"], ["02", "裁判理由部分", "已回应主要争点"], ["03", "裁判主文部分", state.condition === "decisional" ? "系统草案 · 等待法官修改" : "法官完成 · 等待复核"]] },
    audit: { eyebrow: "FINAL REVIEW", title: "最终复核与签署", status: "法官完成", rows: [["✓", "返回原始材料抽查", "已完成"], ["✓", "核对事实、理由与主文", state.condition === "decisional" ? "修改两处并重写责任边界" : "逐段核对完成"], ["✓", "承办法官电子签署", "签署责任归属明确"]] },
  };
  return artifacts[kind];
}

function scrollChatToBottom() { const stream = qs("#chat-stream"); stream.scrollTop = stream.scrollHeight; }

function renderDecision() {
  const data = CASES[state.caseType]; qs("#judgment-case-number").textContent = data.number;
  qs("#judgment-content").innerHTML = `<h2>刑事裁判摘要（研究材料）</h2>${data.judgment.map((p) => `<p>${p}</p>`).join("")}<ol>${data.orders.map((order) => `<li>${order}</li>`).join("")}</ol>`;
  qs("#decision-modification").textContent = { none: "文本由审判团队形成", procedural: "法官独立形成实质内容", substantive: "法官自行选择分析路径", decisional: "法官修改两处理由并重写责任边界" }[state.condition];
}

function renderRanking() {
  qs("#ranking-list").innerHTML = state.ranking.map((subject,index) => `<div class="ranking-item"><span class="rank-number">${index+1}</span><strong>${subject}</strong><div class="rank-actions"><button type="button" data-rank-up="${index}" ${index===0?"disabled":""} aria-label="将${subject}上移">↑</button><button type="button" data-rank-down="${index}" ${index===state.ranking.length-1?"disabled":""} aria-label="将${subject}下移">↓</button></div></div>`).join("");
  qsa("[data-rank-up]").forEach((button) => button.addEventListener("click", () => moveRank(Number(button.dataset.rankUp), -1)));
  qsa("[data-rank-down]").forEach((button) => button.addEventListener("click", () => moveRank(Number(button.dataset.rankDown), 1)));
}
function moveRank(index, direction) { const target = index + direction; if (target < 0 || target >= state.ranking.length) return; [state.ranking[index],state.ranking[target]]=[state.ranking[target],state.ranking[index]]; renderRanking(); }
function renderRatings() {
  qs("#rating-list").innerHTML = RATINGS.map(([name,label]) => `<div class="rating-row"><label for="rating-${name}">${label}</label><div class="rating-control"><input id="rating-${name}" name="${name}" type="range" min="1" max="7" value="4" step="1" /><output class="rating-value" for="rating-${name}">4</output><div class="rating-ends"><span>完全不同意</span><span>完全同意</span></div></div></div>`).join("");
  qsa('.rating-control input[type="range"]').forEach((input) => input.addEventListener("input", () => { input.nextElementSibling.value = input.value; }));
}

function submitSurvey(event) {
  event.preventDefault(); const form = event.currentTarget;
  if (!form.reportValidity()) { qs("#survey-error").textContent = "请完成所有必答题。"; return; }
  const data = new FormData(form); const ratings = Object.fromEntries(RATINGS.map(([name]) => [name, Number(data.get(name))]));
  state.response = { sessionId: state.sessionId, role: state.role, condition: state.condition, caseType: state.caseType, replayCompleted: state.replayIndex === CONDITION_REPLAY[state.condition].length, replayExposureMs: state.replayExposureMs, manipulationCheck: data.get("manipulationCheck"), finalSigner: data.get("finalSigner"), ranking: [...state.ranking], ratings, openResponse: String(data.get("openResponse") || ""), retained: null, submittedAt: new Date().toISOString(), prototype: true };
  saveResponse(state.response); setStep("debrief");
}

function retainResponse() { if (!state.response) return; state.response.retained = true; updateSavedResponse(state.response); qs("#retain-status").textContent = "已记录：同意匿名保留本次回答。"; toast("保留选择已记录"); }
function deleteResponse() { if (!state.response) return; const records = getRecords().filter((item) => item.sessionId !== state.response.sessionId); localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); state.response.retained = false; qs("#retain-status").textContent = "本次回答已从当前浏览器删除。"; toast("本次回答已删除"); }
function downloadResponse() { if (!state.response) return; downloadBlob(JSON.stringify(state.response,null,2), `${state.response.sessionId || "response"}.json`, "application/json"); }

function setStep(step) {
  stopAutoReplay(); state.step = step;
  qsa(".study-screen").forEach((screen) => screen.classList.toggle("active", screen.id === `screen-${step}`));
  const steps = ["intro","dossier","replay","decision","survey","debrief"]; const current = steps.indexOf(step);
  qsa(".study-progress li").forEach((item,index) => { item.classList.toggle("active", index===current); item.classList.toggle("done", index<current); });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getRecords() { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function saveResponse(response) { const records = getRecords(); records.push(response); localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function updateSavedResponse(response) { const records = getRecords(); const index = records.findIndex((item) => item.sessionId === response.sessionId); if (index >= 0) records[index] = response; else records.push(response); localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }

function renderRecords() {
  const records = getRecords(); const body = qs("#records-body"); if (!body) return;
  qs("#metric-complete").textContent = records.length;
  qs("#metric-fairness").textContent = records.length ? (records.reduce((sum,item)=>sum+(item.ratings?.fairness||0),0)/records.length).toFixed(1) : "—";
  qs("#metric-judge-first").textContent = records.length ? `${Math.round(records.filter((item)=>item.ranking?.[0]==="本案承办法官").length/records.length*100)}%` : "—";
  qs("#metric-latest").textContent = records.length ? formatTime(records.at(-1).submittedAt) : "—";
  body.innerHTML = records.length ? records.slice().reverse().map((item)=>`<tr><td>${escapeHtml(item.sessionId)}</td><td>${LABELS.roles[item.role]||item.role}</td><td>${LABELS.conditions[item.condition]||item.condition}</td><td>${LABELS.cases[item.caseType]||item.caseType}</td><td>${item.ratings?.fairness||"—"}</td><td>${formatTime(item.submittedAt)}</td></tr>`).join("") : '<tr><td colspan="6" class="empty-cell">尚无测试记录。完成一次参与者流程后，记录会显示在这里。</td></tr>';
}

function exportCsv() {
  const records = getRecords(); if (!records.length) return toast("当前没有可导出的测试记录");
  const header = ["session_id","role","condition","case_type","replay_completed","replay_exposure_ms","fairness","control","clarity","judge_ownership","ai_trust","legitimacy","acceptance","unease","rank_1","manipulation_check","final_signer","retained","submitted_at"];
  const rows = records.map((r)=>[r.sessionId,r.role,r.condition,r.caseType,r.replayCompleted,r.replayExposureMs,r.ratings?.fairness,r.ratings?.control,r.ratings?.clarity,r.ratings?.judgeOwnership,r.ratings?.aiTrust,r.ratings?.legitimacy,r.ratings?.acceptance,r.ratings?.unease,r.ranking?.[0],r.manipulationCheck,r.finalSigner,r.retained,r.submittedAt]);
  downloadBlob([header,...rows].map((row)=>row.map(csvCell).join(",")).join("\n"),"judicial-ai-prototype.csv","text/csv;charset=utf-8");
}

function valid(value, choices, fallback) { return choices.includes(value) ? value : fallback; }
function randomChoice(items) { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return items[bytes[0] % items.length]; }
function token(length) { const alphabet="abcdefghjkmnpqrstuvwxyz23456789"; const bytes=new Uint8Array(length); crypto.getRandomValues(bytes); return [...bytes].map((value)=>alphabet[value%alphabet.length]).join(""); }
function formatTime(value) { if (!value) return "—"; return new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value)); }
function csvCell(value) { const text=String(value??""); return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text; }
function escapeHtml(value) { return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function downloadBlob(content, filename, type) { const blob=new Blob(["\ufeff",content],{type}); const url=URL.createObjectURL(blob); const link=document.createElement("a"); link.href=url; link.download=filename; link.click(); setTimeout(()=>URL.revokeObjectURL(url),500); }
function wait(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }
let toastTimer; function toast(message) { const el=qs("#toast"); clearTimeout(toastTimer); el.textContent=message; el.classList.remove("hidden"); toastTimer=setTimeout(()=>el.classList.add("hidden"),2800); }

