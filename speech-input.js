(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StudySpeech = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const END_TIMEOUT_MS = 5000;
  const START_TIMEOUT_MS = 12000;
  const ERROR_MESSAGES = {
    "not-allowed": "未获得麦克风权限。可在浏览器中允许访问后重试，或继续手动输入。",
    "service-not-allowed": "浏览器不允许使用语音识别服务，请继续手动输入。",
    "network": "语音识别网络连接失败。可稍后重试，或继续手动输入。",
    "no-speech": "未检测到语音。可再次开始，或继续手动输入。",
    "audio-capture": "无法使用麦克风。请检查设备，或继续手动输入。",
    "language-not-supported": "当前语音服务不支持中文识别，请继续手动输入。",
    "aborted": "语音识别已中断。可再次开始，或继续手动输入。",
    "start-timeout": "语音识别启动超时，已停止等待。请按下方方法使用系统听写或输入法语音，也可直接打字。",
    "start-failed": "语音识别无法启动。可稍后重试，或继续手动输入。",
    "stop-failed": "正在尝试中断语音识别，请等待结束；期间仍可手动输入。",
    "end-timeout": "本次语音输入已停止。未能及时收到结束通知，已请求中断识别服务。请检查已有文字，可继续手动输入或重试。",
    "unknown": "语音识别发生错误。可稍后重试，或继续手动输入。",
  };

  // maxlength counts UTF-16 code units. Do not leave half an emoji at its boundary.
  function boundedText(value, length) {
    const text = value.slice(0, Math.max(0, length));
    return /[\uD800-\uDBFF]$/.test(text) ? text.slice(0, -1) : text;
  }

  function inputHelp(ua='',touchPoints=0){
    const mobile=/Android|iPhone|iPad|Mobile/i.test(ua)||(/Macintosh/i.test(ua)&&touchPoints>1);
    const safari=!mobile&&/Safari/i.test(ua)&&!/Chrome|Chromium|Edg|OPR/i.test(ua);
    if(mobile)return {safari:false,label:'打开输入框，用键盘麦克风说话',help:'点击回答框，再点手机键盘上的麦克风（需输入法支持）。本页按钮不会自动启动键盘录音；没有麦克风时可直接打字。'};
    if(/Macintosh|Mac OS X/i.test(ua))return {safari,label:'使用 Mac 听写（查看方法）',help:'Mac：在“系统设置 → 键盘 → 听写”中开启听写并选择中文；点回答框后，使用设置的听写快捷键，或菜单“编辑 → 开始听写”（若可用）。'+(safari?' Safari 网页识别还依赖系统语音服务，请检查 Siri／听写设置及本网站的麦克风权限。':'')};
    if(/Windows/i.test(ua))return {safari:false,label:'使用 Windows 语音键入（Win + H）',help:'Windows：先点回答框，再按 Win + H 启动系统语音键入，允许麦克风访问并选择中文。需要系统支持及可用网络；没有此功能时可直接打字。'};
    return {safari:false,label:'打开回答框（可使用输入法语音）',help:'点击回答框后，可使用系统或输入法提供的语音输入功能；本页按钮只定位输入框，不会自动开启系统录音。也可以直接打字。'};
  }

  function create({ textarea, startButton, stopButton, keyboardButton, status, interim, help, onChange }) {
    const host = typeof window !== "undefined" ? window : null;
    const Recognition = host && (host.SpeechRecognition || host.webkitSpeechRecognition);
    const wechat = /MicroMessenger/i.test(host?.navigator?.userAgent || '');
    const supported = !wechat && typeof Recognition === "function";
    const platformHelp=inputHelp(host?.navigator?.userAgent||'',host?.navigator?.maxTouchPoints||0);
    if(help)help.textContent=platformHelp.help;
    if(keyboardButton)keyboardButton.textContent=platformHelp.label;
    let keyboardHintsUsed = 0;
    if(keyboardButton){keyboardButton.classList.toggle('hidden',false);startButton.classList.toggle('hidden',!supported);stopButton.classList.toggle('hidden',!supported);}
    const limit = Number.isInteger(textarea.maxLength) && textarea.maxLength >= 0
      ? Math.min(800, textarea.maxLength) : 800;
    const errors = [];
    let active = null;
    let destroyed = false;
    let attempts = 0;
    let textUsed = textarea.value.length > 0;
    let speechUsed = false;
    let limitReached = textarea.value.length >= limit;
    let limitNotice = limitReached;
    let idleMessage = wechat ? "微信内未接入网页自动转写。请点回答框，再点击手机键盘上的麦克风（需输入法支持）；也可以直接打字。" : supported
      ? "可尝试浏览器中文语音识别，能否连接取决于权限及网络。也可按页面说明使用系统听写、输入法语音或直接手动输入。"
      : "当前浏览器不支持网页语音识别。可按页面说明使用系统听写、输入法语音，或直接手动输入。";
    textarea.maxLength = limit;
    textarea.value = boundedText(textarea.value, limit);
    let lastValue = textarea.value;

    function getMetadata() {
      return {
        supported,
        environment:wechat?'wechat':'browser',keyboardHintsUsed,
        language: "zh-CN",
        inputMethod: speechUsed ? (textUsed ? "mixed" : "speech") : "text",
        attempts,
        errors: errors.slice(),
        limitReached,
      };
    }

    function render() {
      startButton.disabled = destroyed || !supported || Boolean(active) || textarea.value.length >= limit;
      stopButton.disabled = destroyed || !active || active.stopping;
      if (destroyed) return;
      if (active?.error) {
        status.textContent = ERROR_MESSAGES[active.error];
      } else if (limitNotice) {
        status.textContent = `已达 ${limit} 字上限，超出部分未写入。请检查并编辑文字。${active ? "正在停止语音识别，请等待结束。" : attempts > 0 ? "语音输入已停止。" : ""}`;
      } else if (active?.stopping) {
        status.textContent = "正在停止语音识别，等待最后的识别结果。结束后请检查文字。";
      } else if (active) {
        status.textContent = active.started
          ? "正在识别中文语音。您仍可编辑文字；说完后请点击停止并检查识别结果。"
          : "正在启动语音识别，请按浏览器提示允许麦克风访问。";
      } else {
        status.textContent = idleMessage;
      }
    }

    function notifyChange(source) {
      if (textarea.value === lastValue) return;
      lastValue = textarea.value;
      if (source === "speech") speechUsed = true;
      else textUsed = true;
      if (typeof onChange === "function") onChange({ value: lastValue, source, metadata: getMetadata() });
    }

    function detach(session) {
      clearTimeout(session.startTimer);
      session.startTimer = null;
      clearTimeout(session.endTimer);
      session.endTimer = null;
      const recognition = session.recognition;
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    }

    function recordError(session, code) {
      clearTimeout(session.startTimer);
      session.startTimer = null;
      const knownCode = Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code) ? code : "unknown";
      errors.push(knownCode);
      session.error = knownCode;
      idleMessage = ERROR_MESSAGES[knownCode];
      interim.textContent = "";
    }

    function awaitEnd(session) {
      if (session.endTimer !== null) return;
      session.endTimer = setTimeout(() => {
        if (destroyed || active !== session) return;
        recordError(session, "end-timeout");
        active = null;
        detach(session);
        // Invalidate callbacks before abort: late results must not change a manual answer.
        try { session.recognition.abort(); } catch (_) { /* Manual input remains available. */ }
        render();
      }, END_TIMEOUT_MS);
    }

    function stop() {
      if (destroyed || !active || active.stopping) return;
      const session = active;
      session.stopping = true;
      clearTimeout(session.startTimer);session.startTimer=null;
      awaitEnd(session);
      render();
      try {
        session.recognition.stop();
      } catch (_) {
        recordError(session, "stop-failed");
        // Allow final results until onend, with a bounded fallback if it never arrives.
        try { session.recognition.abort(); } catch (_) { /* The end timeout will release the session. */ }
        render();
      }
    }

    function reachedLimit() {
      limitReached = true;
      limitNotice = true;
      if (active) active.atLimit = true;
      interim.textContent = "";
      stop();
      render();
    }

    function handleInput() {
      if (destroyed) return;
      const rawValue = textarea.value;
      textarea.value = boundedText(rawValue, limit);
      if (rawValue.length >= limit) reachedLimit();
      else limitNotice = false;
      render();
      notifyChange("text");
    }

    function start(event) {
      event?.preventDefault();
      if (destroyed || !supported || active) return;
      if (textarea.value.length >= limit) { reachedLimit(); return; }
      attempts += 1;
      limitNotice = false;
      interim.textContent = "";
      const session = { recognition: null, finals: new Set(), started: false, stopping: false, error: null, atLimit: false, endTimer: null, startTimer: null };
      active = session;
      render();
      try {
        // Construct and start only in response to the participant's explicit click.
        const recognition = new Recognition();
        session.recognition = recognition;
        recognition.lang = "zh-CN";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        const isCurrent = () => !destroyed && active === session;
        recognition.onstart = () => {
          if (!isCurrent()) return;
          clearTimeout(session.startTimer);session.startTimer=null;
          session.started = true;
          render();
        };
        recognition.onresult = (resultEvent) => {
          if (!isCurrent() || session.error || session.atLimit) return;
          clearTimeout(session.startTimer);session.startTimer=null;session.started=true;
          let finalText = "";
          let interimText = "";
          // Results are cumulative per session. Final indexes never get appended twice,
          // including when the participant edits or deletes an earlier transcription.
          for (let index = 0; index < resultEvent.results.length; index += 1) {
            const result = resultEvent.results[index];
            const transcript = result[0]?.transcript || "";
            if (result.isFinal) {
              if (!session.finals.has(index)) {
                session.finals.add(index);
                finalText += transcript;
              }
            } else {
              interimText += transcript;
            }
          }
          interim.textContent = interimText;
          if (finalText) {
            const remaining = Math.max(0, limit - textarea.value.length);
            const addition = boundedText(finalText, remaining);
            // Read the live value, so manual edits during recognition are preserved.
            textarea.value += addition;
            if (addition.length < finalText.length || textarea.value.length >= limit) reachedLimit();
            notifyChange("speech");
          }
          render();
        };
        recognition.onerror = (errorEvent) => {
          if (!isCurrent()) return;
          recordError(session, errorEvent.error);
          session.stopping = true;
          awaitEnd(session);
          render();
        };
        recognition.onend = () => {
          if (!isCurrent()) return;
          detach(session);
          active = null;
          interim.textContent = "";
          if (!session.error) idleMessage = "语音输入已结束。请检查并修改识别文字，也可继续手动输入。";
          else if (session.error === "stop-failed") idleMessage = "语音识别已结束。停止过程中发生错误，请检查已有文字，也可继续手动输入。";
          render();
        };
        session.startTimer=setTimeout(()=>{
          if(!isCurrent()||session.started||session.stopping)return;
          recordError(session,'start-timeout');active=null;detach(session);
          try{recognition.abort();}catch(_){}
          render();
        },START_TIMEOUT_MS);
        recognition.start();
      } catch (error) {
        recordError(session, ["NotAllowedError", "SecurityError"].includes(error.name) ? "not-allowed" : "start-failed");
        if (session.recognition) detach(session);
        active = null;
        render();
      }
    }

    function handleStop(event) { event.preventDefault(); stop(); }

    function release() {
      const session = active;
      active = null;
      interim.textContent = "";
      if (session) {
        detach(session);
        try { session.recognition.abort(); } catch (_) { /* Page teardown is best effort. */ }
        idleMessage = "语音输入已停止。请检查已有文字，也可继续手动输入。";
      }
      render();
    }

    function keyboardInput(event){event.preventDefault();if(destroyed)return;keyboardHintsUsed+=1;if(active)release();textarea.focus();idleMessage=platformHelp.help;render();}
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      keyboardButton?.removeEventListener("click", keyboardInput);
      startButton.removeEventListener("click", start);
      stopButton.removeEventListener("click", handleStop);
      textarea.removeEventListener("input", handleInput);
      host?.removeEventListener("pagehide", release);
      release();
    }

    keyboardButton?.addEventListener("click", keyboardInput);
    startButton.addEventListener("click", start);
    stopButton.addEventListener("click", handleStop);
    textarea.addEventListener("input", handleInput);
    host?.addEventListener("pagehide", release);
    interim.textContent = "";
    render();
    return { isBusy: () => Boolean(active), getMetadata, stop, destroy };
  }

  return { create, inputHelp };
});
