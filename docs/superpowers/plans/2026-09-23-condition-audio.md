# 条件化法官自述音频实施计划

**Goal:** 发布已获授权的八份条件化录音与同步自述。
**Architecture:** 复用现有播放界面；新增条件化开场文字、按条件音频配置及分段计时，保留原案正文与问卷数据。
**Tech Stack:** FFmpeg、本地 faster-whisper、原生 JavaScript、Node tests、GitHub Pages。

- [x] 转写三个来源文件，确认四个开场边界与两个案件身份。
- [x] 先增加失败的测试：条件与正文映射、八个音频、分段揭示和错误配置。
- [x] 切出四段；拼接原案录音；保存八个文件、对应 TXT 及可重现制作清单。
- [x] 更新 study-narration.js、study-playback.js、audio-config.js 和 app.js；更新文案和版本。
- [x] 运行规则与媒体测试；浏览器验证实际播放、暂停、重播和旧草稿升级。
- [ ] 构建、提交、PR、部署并核对公开音频资源。
