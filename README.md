# 人机协同裁判司法责任研究

供合作者审阅和预测试的静态网站。当前版本为 2.2.0；参与者仍依次完成故意伤害与侵犯著作权两案。没有新增采集后台，回答仅保存在参与者当前浏览器。

## 当前实验设计

- 背景只问四选一：法官／法官助理、其他法律相关人员、律师、其他。法官及助理进入法官组，律师进入律师组；其他两类进入大众池，以 1∶1 概率随机分配当事人或公众视角。不再逐项询问法律行业、学位、执照或诉讼经历，不允许自选模拟视角。
- 当事人视角：故意伤害案为被害人的近亲属；侵犯著作权案为代表被侵权的软件著作权方。
- 四种 AI 条件：无 AI、程序性、实质性、决定性。第一人称开场录音与文字随条件变化；正文材料整理、证据与法律分析、裁判结果形成三个位置增加同样红色样式的分工提示。案件事实、录音正文、裁判结果及评价界面一致。当前各条件独立按25%概率随机；集中均衡分配尚未上线。
- 每人完成两案，先后随机；角色和 AI 条件保持不变。律师身份来自职业自我报告，法官及法官助理身份来自职业自我报告，不能将四类视角差异全部解释为随机操纵的因果效果。
- 每案开始播放与案件和角色对应的 18 秒情境 B-roll（六个 3 秒镜头；字幕仍每 6 秒一段），共八条。四类视角节奏、字幕样式、编码一致，无声音，无 AI 条件线索；同一案件及角色的视频在四种 AI 条件下相同。当事人采用近亲属／权利方代表的第一人称视角，公众从新闻旁观视角了解案件。角色文字在前台显示3秒即可继续，按钮显示剩余秒数；不再要求看完整条短片。视频未播放或加载失败都不会延长门槛。
- 三部分材料每部分至少阅读8秒、滚动到末尾并勾选确认；勾选后自动进入下一部分，第三部分确认后自动进入裁判形成记录。
- 每案四份法官第一人称陈述录音，按 AI 条件自动选择。开场明确 AI 如何参与，文字与声音一致并用颜色突出；案件正文保留原稿。录音默认 1.5 倍速，可改为 1 或 1.25 倍。文字独立于录音，在页面前台阅读约 15 秒后全部展开；读到末尾并勾选确认即可继续，无需完整播放录音。
- 所有条件都显示四个责任主体（审判团队、法院、技术提供方、AI 系统），先逐一独立评 0–100 分（可同分、不限总和），再分配合计恰好 100 分的责任；两步都必答，无默认值，0 必须明确填写。详见 [责任测量说明](docs/responsibility-measurement.md)。七点量表采用横向 1–7 滑动条，也可点击数字，选择后显示完整量程含义。滑块初始位置不作为回答，实际值为空；每项必须主动选择 1–7 分，不提供“无法判断”；旧未提交草稿中的该选项清空后重新作答，既有答卷保留原值。情境代入题使用同样的滑动条。
- 开放题和语音输入均可选。每案评价后增加一项案件伤害程度协变量：参与者以 1–7 分评价本案对自己的伤害程度，单独保存为 `perceivedHarm`；另保留探索性情境代入检查 `involvement`，不自动用于排除，也不代表经过验证的完整量表。
- 开始时确认研究用途；提交后保留回答，不再二次询问是否用于研究，仍可撤回删除整次会话。

视频文件时长仍为18秒，参与者在阅读情景3秒后即可离开；时长设置本身并不证明代入操纵已经有效。视频与角色文字共同构成情境操纵，不能将组间差异单独归因于视频。

## 访问和预览

[参与者入口](https://zhy1126.github.io/ai-judicial-responsibility-study/?view=participant)

[研究者预览台](https://zhy1126.github.io/ai-judicial-responsibility-study/)

设计台有 32 条预览路径（4 角色 × 4 条件 × 2 起始案件）。例如 `/?view=participant&preview=1&role=public&condition=procedural&case=natural`。网址参数仅在预览模式生效，预览数据标记 `preview:true`，不能混入实际被试数据。

## 材料与配音

案例来自研究者提供的两份 Word。原件不上传仓库；展示为去标识化摘要。法官陈述是依据案例编写的研究材料，不是真实法官的工作记录或原声。

`study-narration.js` 保留0916版案件正文，并为四种条件分别加入已录制的第一人称 AI 参与说明，版本 `condition-narration-2026-09-23-v1`。已接入两案 × 四条件共八份音频，配置在 `audio-config.js`。`audio/condition-scripts/` 提供完整 TXT；录音同案各版本仅开场说明不同。0927版在正文相应段落前增加标为“本环节分工”的补充说明，不伪装成录音逐字稿；版本记录为`participationPresentation=stage-disclosure-2026-09-27-v1`。辅助文字在约 15 秒内独立展开，读完确认即可继续；录音可边听边看，不作为继续门槛。详见 [配音接入说明](docs/audio-handoff.md)。

`role-media.js` 按 `cases[caseType][role]` 声明八个 18 秒视频，版本 `case-role-broll-2026-09-16-v5`。当事人以第一人称看见医院等候、案件材料、民事赔偿沟通或游戏传播及案中物品。所有画面不包含凶器、冲突动作、受伤、患者或遗体，游戏屏幕只用风景。字幕采用自然短句及明确指定的简体中文字体（PingFang SC），可编辑文本见 `docs/video-subtitles-v5.json`。字幕依据原案事实，场景、人物及屏幕细节为示意重构；不提前呈现判决或预设情绪。画面由内置图像生成工具制作，采用缓慢运镜，这不是人物动态表演。优化视频与封面位于 `video/`；旧 v2 文件仅用于兼容旧页面。详见 [分镜说明](docs/case-role-broll.md)。

历史 `study-dialogue.js`、`study-stream.js`、`audio/scripts/` 与旧导出脚本仅留档，不再加载或部署；不要使用旧八份对话稿配音。

## 数据与升级

会话协议仍为 `two-cases-2026-09-08-v1`。一位参与者对应一个 session，含两个独立 `responses`。第一案提交、第二案中途、全部完成后均可刷新继续；第二案重新计阅读、播放、责任评分／分配和评价。

升级保留旧分组、体验编号和已提交答卷。未完成旧材料需重新阅读新版材料及角色提示；缺少研究用途同意时需补充确认。角色视频版本更新后，当前尚未提交案件的阅读、陈述和评价重置，防止混用两个视频版本；已提交案件原样保留。新旧刺激材料用 `version`、`caseVersion`、`narrationVersion`、`orientation.version`、`presentation` 区分，不应混作同一版本。旧单案继续第二案时标记 `migratedFrom:single_case`，原答卷保持原样。

CSV 每案一行，同一人共享 session_id；记录 narration_version、participation_presentation、condition_line、consent、orientation、perceived_harm 与 involvement。orientation.minimumReadingMs记录本版情景最低阅读门槛。JSON 下载和删除针对整次会话。旧页面写入保护、删除标记和清空版本控制继续保留。

正式进度保存在 localStorage；预览草稿保存在 sessionStorage。试运行问卷已接入集中数据库及服务器分组，答卷加密备份到私有仓库；未完成草稿保留在本机。没有跨设备身份识别。全体数据须在集中管理后台登录查看，本机设计台仅展示本机副本。

浏览器语音使用 SpeechRecognition，主动点击后才申请麦克风。微信内提供手机键盘语音入口及操作提示，避免显示不可用的网页识别按钮；这并非接入微信 JS-SDK 或云端转写。输入法未启用语音时仍可打字；键盘语音是否实际使用无法由网页识别，元数据只记录入口使用。仅保存核对后的文字与输入元数据，不保存原始录音。真实麦克风和目标手机仍需现场预测试，不需要把配音服务密钥放在网页里。

## 验证与发布

```sh
node --test tests/mobile-survey-repair.test.cjs tests/role-video-player.test.cjs tests/collection-client.test.cjs tests/collection-flow.test.cjs tests/condition-audio.test.cjs tests/playback-progress.test.cjs tests/legal-background.test.cjs tests/study-core.test.cjs tests/study-session.test.cjs tests/speech-input.test.cjs tests/narration-design.test.cjs tests/shared-narration.test.cjs tests/responsibility-scores.test.cjs tests/stage-participation.test.cjs
node scripts/build.mjs
python3 -m http.server 8766 --directory _site
# 另一个终端，需 Playwright + Chromium
STUDY_TEST_URL=http://127.0.0.1:8766 node tests/speed-speech-flow.test.cjs
STUDY_TEST_URL=http://127.0.0.1:8766 node tests/required-ratings-flow.test.cjs
STUDY_TEST_URL=http://127.0.0.1:8766 node tests/scenario-stage-flow.test.cjs
STUDY_TEST_URL=http://127.0.0.1:8766 node tests/audio-pending-pause.test.cjs
STUDY_TEST_URL=http://127.0.0.1:8766 node tests/stage-draft-migration.test.cjs
```

可用 PLAYWRIGHT_PATH、PLAYWRIGHT_BROWSERS_PATH 和 STUDY_TEST_URL 指定测试环境。旧的 chatbot/dialogue、mobile-flow、narration-revision 等浏览器脚本保留对应历史版本假设；当前音频与阅读流程以 speed-speech-flow 为准；condition-audio-flow 保留 0923 版完整收听假设。main 更新后 GitHub Actions 执行规则测试、构建并发布至原 GitHub Pages。构建不包含原始案例、测试、配音文字或内部说明。

当前四选一背景版本为 `four-choice-background-2026-09-20-v1`。早期多道背景问题保留在旧数据兼容逻辑中，不作为当前界面设计。AI参与说明位于自述顶部，并在正文的对应环节再次说明。

背景题不预选；继续已有会话保留分组及已提交答卷。0927更新缩短情景最低阅读时长、补充分工说明及修复加载中暂停的错误处理。尚未提交的旧版评价草稿需重新阅读新版分工提示并重新评价，避免没看过新提示的答卷被标成新版；已提交回答不改写。旧情景已完成但未记录最低阅读门槛的，保留未知值，不倒填成3秒。播放尚未加载完成时暂停会产生正常的AbortError取消；网页不再将它标为播放故障，因此续播不会因此重新下载录音。真实Safari和不同网络仍需预测试。

0928 手机填写修复：两道责任题连续展示，独立评分完成后自动开放合计 100 的分配题，分数持续可见，不自动复制或换算。提交按钮只在保存请求期间停用；未填项和无效值给出具体提示并定位。情境短片显示真实的加载／播放／缓冲状态，支持原生控件及重试，文字阅读门槛仍为 3 秒。回归测试覆盖加载挂起、取消与重试、旧播放回调和缓冲中继续播放，实体 iPhone／微信网络仍需现场复测。
