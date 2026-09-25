# 人机协同裁判司法责任研究

供合作者审阅和预测试的静态网站。当前版本为 2.2.0；参与者仍依次完成故意伤害与侵犯著作权两案。没有新增采集后台，回答仅保存在参与者当前浏览器。

## 当前实验设计

- 三类背景：法官及法官助理、律师、其余人员。先询问当前是否从事法律相关工作；回答是后选择当前律师、法官／法官助理或其他法律工作。其他法律工作再细分职业，选择“其他”需注明。当前法官与法官助理直接进入同组，当前律师进入律师组。其余人员保留既往法官办案经历问题，曾作为承办法官或合议庭成员办案者也纳入法官组；均不符合者为大众，以 1∶1 概率随机进入模拟当事人或无关群众视角。法学学位、既往诉讼经历只作为背景记录，不决定随机分组；不设检察官组，不允许自选模拟角色。
- 当事人视角：故意伤害案为被害人的近亲属；侵犯著作权案为代表被侵权的软件著作权方。
- 四种 AI 条件：无 AI、程序性、实质性、决定性。**同一案件仅 AI 参与程度提示与第一人称开场（含对应录音）不同**，后续案件分析、裁判结果及评价界面相同。
- 每人完成两案，先后随机；角色和 AI 条件保持不变。律师身份来自职业自我报告，法官及法官助理身份来自职业／办案经历自我报告，不能将四类视角差异全部解释为随机操纵的因果效果。
- 每案开始播放与案件和角色对应的 18 秒情境 B-roll（六个 3 秒镜头；字幕仍每 6 秒一段），共八条。四类视角节奏、字幕样式、编码一致，无声音，无 AI 条件线索；同一案件及角色的视频在四种 AI 条件下相同。当事人采用近亲属／权利方代表的第一人称视角，公众从新闻旁观视角了解案件。角色文字至少显示 5 秒且短片播放完毕才开放下一步。
- 三部分材料通过底部“下一部分”按钮依次推进，每部分至少阅读 5 秒、滚动到末尾并勾选确认。无需点击上方栏目标题找下一页。
- 每案四份法官第一人称陈述录音，按 AI 条件自动选择。开场明确 AI 如何参与，文字与声音一致并用颜色突出；案件正文保留原稿。录音默认 1.5 倍速，可改为 1 或 1.25 倍。文字独立于录音，在页面前台阅读约 15 秒后全部展开；读到末尾并勾选确认即可继续，无需完整播放录音。
- 所有条件都显示四个责任主体（审判团队、法院、技术提供方、AI 系统），先逐一独立评 0–100 分（可同分、不限总和），再分配合计恰好 100 分的责任；两步都必答，无默认值，0 必须明确填写。详见 [责任测量说明](docs/responsibility-measurement.md)。七点量表采用横向 1–7 滑动条，也可点击数字，选择后显示完整量程含义。滑块初始位置不作为回答，实际值为空；每项必须主动选择 1–7 分，不提供“无法判断”；旧未提交草稿中的该选项清空后重新作答，既有答卷保留原值。情境代入题使用同样的滑动条。
- 开放题和语音输入均可选。每案评价后增加一项案件伤害程度协变量：参与者以 1–7 分评价本案对自己的伤害程度，单独保存为 `perceivedHarm`；另保留探索性情境代入检查 `involvement`，不自动用于排除，也不代表经过验证的完整量表。
- 开始时确认研究用途；提交后保留回答，不再二次询问是否用于研究，仍可撤回删除整次会话。

18 秒是研究者选定的预测试长度，并不证明代入操纵已经有效。视频与角色文字共同构成情境操纵，不能将组间差异单独归因于视频。

## 访问和预览

[参与者入口](https://zhy1126.github.io/ai-judicial-responsibility-study/?view=participant)

[研究者预览台](https://zhy1126.github.io/ai-judicial-responsibility-study/)

设计台有 32 条预览路径（4 角色 × 4 条件 × 2 起始案件）。例如 `/?view=participant&preview=1&role=public&condition=procedural&case=natural`。网址参数仅在预览模式生效，预览数据标记 `preview:true`，不能混入实际被试数据。

## 材料与配音

案例来自研究者提供的两份 Word。原件不上传仓库；展示为去标识化摘要。法官陈述是依据案例编写的研究材料，不是真实法官的工作记录或原声。

`study-narration.js` 保留0916版案件正文，并为四种条件分别加入已录制的第一人称 AI 参与说明，版本 `condition-narration-2026-09-23-v1`。已接入两案 × 四条件共八份音频，配置在 `audio-config.js`。`audio/condition-scripts/` 提供完整 TXT；同案各版本仅开场说明不同。辅助文字在约 15 秒内独立展开，读完确认即可继续；录音可边听边看，不作为继续门槛。详见 [配音接入说明](docs/audio-handoff.md)。

`role-media.js` 按 `cases[caseType][role]` 声明六个 18 秒视频，版本 `case-role-broll-2026-09-16-v5`。当事人以第一人称看见医院等候、案件材料、民事赔偿沟通或游戏传播及案中物品。所有画面不包含凶器、冲突动作、受伤、患者或遗体，游戏屏幕只用风景。字幕采用自然短句及明确指定的简体中文字体（PingFang SC），可编辑文本见 `docs/video-subtitles-v5.json`。字幕依据原案事实，场景、人物及屏幕细节为示意重构；不提前呈现判决或预设情绪。画面由内置图像生成工具制作，采用缓慢运镜，这不是人物动态表演。优化视频与封面位于 `video/`；旧 v2 文件仅用于兼容旧页面。详见 [分镜说明](docs/case-role-broll.md)。

历史 `study-dialogue.js`、`study-stream.js`、`audio/scripts/` 与旧导出脚本仅留档，不再加载或部署；不要使用旧八份对话稿配音。

## 数据与升级

会话协议仍为 `two-cases-2026-09-08-v1`。一位参与者对应一个 session，含两个独立 `responses`。第一案提交、第二案中途、全部完成后均可刷新继续；第二案重新计阅读、播放、责任评分／分配和评价。

升级保留旧分组、体验编号和已提交答卷。未完成旧材料需重新阅读新版材料及角色提示；缺少研究用途同意时需补充确认。角色视频版本更新后，当前尚未提交案件的阅读、陈述和评价重置，防止混用两个视频版本；已提交案件原样保留。新旧刺激材料用 `version`、`caseVersion`、`narrationVersion`、`orientation.version`、`presentation` 区分，不应混作同一版本。旧单案继续第二案时标记 `migratedFrom:single_case`，原答卷保持原样。

CSV 每案一行，同一人共享 session_id；增加 narration_version、condition_line、consent、orientation、perceived_harm 与 involvement。JSON 下载和删除针对整次会话。旧页面写入保护、删除标记和清空版本控制继续保留。

正式进度保存在 localStorage；预览草稿保存在 sessionStorage。当前没有跨设备身份识别、服务器随机分配锁或中央数据库。新参与者应使用独立浏览器环境。设计台只能查看当前浏览器的数据。

浏览器语音使用 SpeechRecognition，主动点击后才申请麦克风。微信内提供手机键盘语音入口及操作提示，避免显示不可用的网页识别按钮；这并非接入微信 JS-SDK 或云端转写。输入法未启用语音时仍可打字；键盘语音是否实际使用无法由网页识别，元数据只记录入口使用。仅保存核对后的文字与输入元数据，不保存原始录音。真实麦克风和目标手机仍需现场预测试，不需要把配音服务密钥放在网页里。

## 验证与发布

```sh
node --test tests/condition-audio.test.cjs tests/playback-progress.test.cjs tests/legal-background.test.cjs tests/study-core.test.cjs tests/study-session.test.cjs tests/speech-input.test.cjs tests/narration-design.test.cjs tests/shared-narration.test.cjs tests/responsibility-scores.test.cjs
node scripts/build.mjs
python3 -m http.server 8766 --directory _site
# 另一个终端，需 Playwright + Chromium
STUDY_TEST_URL=http://127.0.0.1:8766 node tests/speed-speech-flow.test.cjs
STUDY_TEST_URL=http://127.0.0.1:8766 node tests/required-ratings-flow.test.cjs
```

可用 PLAYWRIGHT_PATH、PLAYWRIGHT_BROWSERS_PATH 和 STUDY_TEST_URL 指定测试环境。旧的 chatbot/dialogue、mobile-flow、narration-revision 等浏览器脚本保留对应历史版本假设；当前音频与阅读流程以 speed-speech-flow 为准；condition-audio-flow 保留 0923 版完整收听假设。main 更新后 GitHub Actions 执行规则测试、构建并发布至原 GitHub Pages。构建不包含原始案例、测试、配音文字或内部说明。

本次筛选更新以 `screeningVersion=judicial-team-industry-2026-09-17-v3` 区分，并记录 `backgroundGroup` 和 `judgeCaseExperience`。尚未提交任何一案的旧会话返回背景页重新核对，保留原体验编号、AI 条件、案件顺序；已提交一案以上的旧会话维持原组别，不在两案中途改组。AI 参与说明位于法官独白卡片顶部，正文内部滚动时始终可见；同一案件正文不因 AI 条件改写。

职业细分包含企业法务／合规、书记员／其他审判辅助人员、检察机关工作人员、律师助理／实习律师、法律教学／科研、其他（注明）。该题是实际职业背景，不是自选实验视角。新增 `legalIndustry`、`legalOccupation`、`legalOccupationDetail`、`legalOccupationOther` 字段写入 JSON/CSV；法学学位仍仅作背景记录，是否取得学位都可参加，不决定分组。

背景题在正式页面、预览页面和需要重新核对的旧会话中均不预选；继续已有会话仍保留此前已提交的分组及答卷。本次界面协议为 `mobile-streaming-sliders-2026-09-17-v1`，逐步呈现版本已升级为 `independent-reading-audio-2026-09-25-v1`。保留科学研究用途与撤回说明；删除参与者材料中的原始案号缺失、证据未提供等编辑备注，不补造案号或证据。
