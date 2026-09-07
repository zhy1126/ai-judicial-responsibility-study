(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StudySpeech = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const END_TIMEOUT_MS = 5000;
  const ERROR_MESSAGES = {
    "not-allowed": "未获得麦克风权限。可在浏览器中允许访问后重试，或继续手动输入。",
    "service-not-allowed": "浏览器不允许使用语音识别服务，请继续手动输入。",
    "network": "语音识别网络连接失败。可稍后重试，或继续手动输入。",
    "no-speech": "未检测到语音。可再次开始，或继续手动输入。",
    "audio-capture": "无法使用麦克风。请检查设备，或继续手动输入。",
    "language-not-supported": "当前语音服务不支持中文识别，请继续手动输入。",
    "aborted": "语音识别已中断。可再次开始，或继续手动输入。",
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

  function create({ textarea, startButton, stopButton, status, interim, onChange }) {
    const host = typeof window !== "undefined" ? window : null;
    const Recognition = host && (host.SpeechRecognition || host.webkitSpeechRecognition);
    const supported = typeof Recognition === "function";
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
    let idleMessage = supported
      ? "中文语音输入可用。点击开始后才会请求麦克风权限，也可直接手动输入。"
      : "当前浏览器不支持语音识别，请直接手动输入。";
    textarea.maxLength = limit;
    textarea.value = boundedText(textarea.value, limit);
    let lastValue = textarea.value;

    function getMetadata() {
      return {
        supported,
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
      clearTimeout(session.endTimer);
      session.endTimer = null;
      const recognition = session.recognition;
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    }

    function recordError(session, code) {
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
      const session = { recognition: null, finals: new Set(), started: false, stopping: false, error: null, atLimit: false, endTimer: null };
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
          session.started = true;
          render();
        };
        recognition.onresult = (resultEvent) => {
          if (!isCurrent() || session.error || session.atLimit) return;
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

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      startButton.removeEventListener("click", start);
      stopButton.removeEventListener("click", handleStop);
      textarea.removeEventListener("input", handleInput);
      host?.removeEventListener("pagehide", release);
      release();
    }

    startButton.addEventListener("click", start);
    stopButton.addEventListener("click", handleStop);
    textarea.addEventListener("input", handleInput);
    host?.addEventListener("pagehide", release);
    interim.textContent = "";
    render();
    return { isBusy: () => Boolean(active), getMetadata, stop, destroy };
  }

  return { create };
});
