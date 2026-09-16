# 两份共用法官陈述：配音接入

目前每案只需一份录音，四种 AI 条件共用。AI 参与程度仅由网页提示行区分，不能写进朗读稿或配音。

## 文稿

当前文字来自 `study-narration.js`，对应 `audio/shared-scripts/natural.txt`（故意伤害）和 `statutory.txt`（侵犯著作权）。已按研究者提供的两份《法官陈述配音稿0916.docx》原文同步，故意伤害5段、侵犯著作权6段；仅提取“朗读正文”，使用说明不呈现给参与者。正文未作润色。旧 `audio/scripts/` 的八份对话稿已经停用。

请先在 Word 中人工修改，再同步网站正文与 TXT，最后配音。使用同一法官音色、普通口语陈述、自然停顿，不配音乐；不添加 AI、书记员、工作分工说明或不同条件特有句子。两案均明确是模拟研究材料，不冒充真实法官原声。

## 文件配置

将两个文件放到 `audio/recordings/`，例如 natural-narration-v1.mp3 和 statutory-narration-v1.mp3，然后更新：

```js
window.STUDY_AUDIO_VERSION='shared-narration-2026-09-16-v2';
window.STUDY_AUDIO={
 natural:'./audio/recordings/natural-narration-v1.mp3',
 statutory:'./audio/recordings/statutory-narration-v1.mp3'
};
```

两案地址配置完整、同源且版本匹配后，所有条件统一启用音频，纯文字始终可见。尚未配齐时统一使用静态文字。不能只给部分条件加录音；修改正文后需同步材料版本和录音版本。

完整收听后开放确认；不自动播放，无快进控件，支持暂停、继续、重播。隐藏标签页或离开播放页会暂停。加载失败时可以重试，不能只为某一条件回退到文字。

请核对两案判决数值、文字音频逐句一致、播放正常、响度相近，再发布。网站不需要配音 API 或 TOKEN。构建会把现有录音复制到发布目录。

## 角色视频和开放题语音

两案 × 三角色共六个视频是独立的 18 秒无声情境引导，不能替代法官陈述录音。开放题语音输入也与配音独立；其支持程度取决于浏览器，参与者可选择打字。
