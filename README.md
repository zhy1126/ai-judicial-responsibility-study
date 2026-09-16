# 人机协同裁判司法责任研究

供合作者审阅和预测试的静态网站。当前版本为 2.2.0；参与者仍依次完成故意伤害与侵犯著作权两案。没有新增采集后台，回答仅保存在参与者当前浏览器。

## 当前实验设计

- 三组：以当前职业自我报告识别律师；非律师以 1∶1 概率随机进入模拟当事人或普通公众组。法学学位、既往诉讼经历仅作为背景记录，不决定非律师分组。不纳入法官／检察官职业组，也不让参与者自行选择模拟角色。
- 当事人视角：故意伤害案为被害人的近亲属；侵犯著作权案为代表被侵权的软件著作权方。
- 四种 AI 条件：无 AI、程序性、实质性、决定性。**同一案件仅 AI 参与程度提示行不同**，陈述正文、录音、裁判结果及评价界面相同。
- 每人完成两案，先后随机；角色和 AI 条件保持不变。律师身份来自职业自我报告，不能将三组差异全部解释为随机操纵的因果效果。
- 每案开始播放所属角色的 18 秒情境短片（三个 6 秒镜头）。三组节奏、字幕样式、编码一致，无声音，无 AI 条件线索；同一角色两案共用短片，网页另外明确本案身份。角色文字至少显示 5 秒且短片播放完毕才开放下一步。
- 三栏材料依次解锁，每栏至少阅读 5 秒、滚动到末尾并勾选确认。
- 每案一份法官第一人称陈述，以音频加纯文字呈现。录音未提供时统一使用完整静态文字，阅读满 30 秒并到达末尾才能继续。没有流式对话。
- 所有条件都显示四个责任主体（审判团队、法院、技术提供方、AI 系统），必须核对并确认完整排序，不能选择跳过。七点量表逐项标明含义，无默认答案。
- 开放题和语音输入均可选。每案评价后增加一项探索性情境代入检查：同意程度 1–7 分，单独保存为 `involvement`，不自动用于排除，也不代表经过验证的完整量表。
- 开始时确认研究用途；提交后保留回答，不再二次询问是否用于研究，仍可撤回删除整次会话。

18 秒是研究者选定的预测试长度，并不证明代入操纵已经有效。视频与角色文字共同构成情境操纵，不能将组间差异单独归因于视频。

## 访问和预览

[参与者入口](https://zhy1126.github.io/ai-judicial-responsibility-study/?view=participant)

[研究者预览台](https://zhy1126.github.io/ai-judicial-responsibility-study/)

设计台有 24 条预览路径（3 角色 × 4 条件 × 2 起始案件）。例如 `/?view=participant&preview=1&role=public&condition=procedural&case=natural`。网址参数仅在预览模式生效，预览数据标记 `preview:true`，不能混入实际被试数据。

## 材料与配音

案例来自研究者提供的两份 Word。原件不上传仓库；展示为去标识化摘要。法官陈述是依据案例编写的研究材料，不是真实法官的工作记录或原声。

`study-narration.js` 是两份共用正文的来源，版本 `shared-narration-2026-09-16-v1`。`audio/shared-scripts/` 提供对应 TXT。音频仅按案件配置：natural 与 statutory。两案均配置同源音频且版本匹配后统一启用播放器，始终保留辅助文字。录音尚未提供。详见 [配音接入说明](docs/audio-handoff.md)。

`role-media.js` 声明三个 18 秒角色视频，版本 `role-immersion-2026-09-16-v2`。画面由内置图像生成工具制作，采用一致缓慢推进和角色字幕；这是静帧运镜视频，不是实拍或人物动态表演。优化视频与封面位于 `video/`。

历史 `study-dialogue.js`、`study-stream.js`、`audio/scripts/` 与旧导出脚本仅留档，不再加载或部署；不要使用旧八份对话稿配音。

## 数据与升级

会话协议仍为 `two-cases-2026-09-08-v1`。一位参与者对应一个 session，含两个独立 `responses`。第一案提交、第二案中途、全部完成后均可刷新继续；第二案重新计阅读、播放、排序和评价。

升级保留旧分组、体验编号和已提交答卷。未完成旧材料需重新阅读新版材料、角色提示并确认研究用途。新旧刺激材料用 `version`、`caseVersion`、`narrationVersion`、`orientation.version`、`presentation` 区分，不应混作同一版本。旧单案继续第二案时标记 `migratedFrom:single_case`，原答卷保持原样。

CSV 每案一行，同一人共享 session_id；增加 narration_version、condition_line、consent、orientation 与 involvement。JSON 下载和删除针对整次会话。旧页面写入保护、删除标记和清空版本控制继续保留。

正式进度保存在 localStorage；预览草稿保存在 sessionStorage。当前没有跨设备身份识别、服务器随机分配锁或中央数据库。新参与者应使用独立浏览器环境。设计台只能查看当前浏览器的数据。

语音输入使用浏览器支持的 SpeechRecognition，主动点击后才申请麦克风；不支持时可打字。仅保存核对后的文字与输入元数据，不保存原始录音。真实麦克风和目标手机仍需现场预测试，不需要把配音服务密钥放在网页里。

## 验证与发布

```sh
node --test tests/study-core.test.cjs tests/study-session.test.cjs tests/speech-input.test.cjs tests/narration-design.test.cjs tests/shared-narration.test.cjs
node scripts/build.mjs
python3 -m http.server 8766 --directory _site
# 另一个终端，需 Playwright + Chromium
node tests/narration-flow.test.cjs
```

可用 PLAYWRIGHT_PATH、PLAYWRIGHT_BROWSERS_PATH 和 STUDY_TEST_URL 指定测试环境。旧的 chatbot/dialogue 等浏览器脚本是历史版本回归，当前以 narration-flow 为准。main 更新后 GitHub Actions 执行规则测试、构建并发布至原 GitHub Pages。构建不包含原始案例、测试、配音文字或内部说明。
