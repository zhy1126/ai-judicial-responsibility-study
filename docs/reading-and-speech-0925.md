# 2026-09-25 阅读与语音输入更新

按研究者最新要求，录音默认 1.5 倍速，提供 1／1.25／1.5 倍选择。文字独立在 15 秒前台阅读时间内展开；全文到底并确认即可继续，不再要求完整收听。正文、八份录音、参与程度分配不变。重播不清空阅读状态，离开页面暂停音频。未完成旧呈现版本的草稿重新阅读，已提交答卷保持原样。

浏览器 SpeechRecognition 的构造函数存在不代表服务能成功连接。新增 12 秒启动超时恢复，防止既无 start 也无 error 回调时永久等待；清除旧回调，保留已有回答。正常识别开始后不施加此启动超时。

Mac Safari 显示系统听写与 Siri／网站麦克风权限检查说明；Windows 显示 Win + H；手机显示输入法麦克风说明。系统听写按钮只定位输入框、说明操作，不能直接启动操作系统录音。未新增云端转写服务，未改动用户系统设置，不能保证已解决该用户 Safari 的实际识别故障。

依据：[WebKit Speech API](https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/)、[Apple 听写说明](https://support.apple.com/en-ng/guide/mac-help/mh40584/mac)、[Windows 语音键入](https://support.microsoft.com/zh-cn/accessibility/windows/use-voice-typing-to-talk-instead-of-type-on-your-pc)。

验证以当前规则测试及 `tests/speed-speech-flow.test.cjs` 为准。使用 Chromium 验证真实 MP3 与页面，Safari 标识和失败回调为模拟环境；未声称已通过真实 Safari 麦克风转写测试。
