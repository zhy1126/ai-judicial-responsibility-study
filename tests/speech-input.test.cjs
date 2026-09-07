const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const modulePath = path.join(__dirname, '..', 'speech-input.js');
const StudySpeech = fs.existsSync(modulePath) ? require(modulePath) : {};

class Element extends EventTarget {
  constructor(value = '') {
    super();
    this.value = value;
    this.textContent = '';
    this.maxLength = 800;
    this.disabled = false;
    this.readOnly = false;
  }
  click() { this.dispatchEvent(new Event('click', { cancelable: true })); }
  type(value) { this.value = value; this.dispatchEvent(new Event('input')); }
}

function setup(t, { unsupported = false, prefixed = false, value = '', maxLength = 800, startError = null, stopError = null } = {}) {
  assert.equal(typeof StudySpeech.create, 'function', 'speech module must expose create()');
  const instances = [];
  class Recognition {
    constructor() { this.startCalls = 0; this.stopCalls = 0; this.abortCalls = 0; instances.push(this); }
    start() { this.startCalls += 1; if (startError) throw startError; }
    stop() { this.stopCalls += 1; if (stopError) throw stopError; }
    abort() { this.abortCalls += 1; }
    emit(type, event = {}) { this['on' + type]?.(event); }
    result(entries, resultIndex = 0) {
      const results = entries.map(([transcript, isFinal]) => Object.assign([{ transcript, confidence: 0.9 }], { isFinal }));
      this.emit('result', { resultIndex, results });
    }
  }
  const previousWindow = global.window;
  const window = new EventTarget();
  if (!unsupported) window[prefixed ? 'webkitSpeechRecognition' : 'SpeechRecognition'] = Recognition;
  global.window = window;
  const textarea = new Element(value);
  textarea.maxLength = maxLength;
  const startButton = new Element();
  const stopButton = new Element();
  const status = new Element();
  const interim = new Element();
  const changes = [];
  const controller = StudySpeech.create({ textarea, startButton, stopButton, status, interim, onChange: change => changes.push(change) });
  t.after(() => { controller.destroy(); if (previousWindow === undefined) delete global.window; else global.window = previousWindow; });
  return { controller, textarea, startButton, stopButton, status, interim, changes, instances, window };
}

test('unsupported browser leaves typing available and never attempts microphone access', t => {
  const f = setup(t, { unsupported: true });
  assert.equal(f.startButton.disabled, true);
  assert.equal(f.stopButton.disabled, true);
  assert.match(f.status.textContent, /不支持.*手动输入/);
  f.textarea.type('直接输入');
  f.startButton.click();
  assert.equal(f.textarea.disabled, false);
  assert.equal(f.textarea.readOnly, false);
  assert.equal(f.textarea.value, '直接输入');
  assert.equal(f.controller.isBusy(), false);
  assert.equal(f.controller.getMetadata().supported, false);
  assert.equal(f.controller.getMetadata().inputMethod, 'text');
  assert.equal(f.changes.at(-1).source, 'text');
});

test('starts Chinese recognition only on a click and blocks rapid duplicate starts', t => {
  const f = setup(t);
  assert.equal(f.instances.length, 0);
  assert.equal(f.controller.isBusy(), false);
  assert.match(f.status.textContent, /可用/);
  f.startButton.click();
  f.startButton.click();
  assert.equal(f.instances.length, 1);
  assert.equal(f.instances[0].startCalls, 1);
  assert.equal(f.instances[0].lang, 'zh-CN');
  assert.equal(f.instances[0].continuous, true);
  assert.equal(f.instances[0].interimResults, true);
  assert.equal(f.controller.isBusy(), true);
  assert.equal(f.startButton.disabled, true);
  assert.equal(f.stopButton.disabled, false);
  assert.equal(f.controller.getMetadata().attempts, 1);
});

test('supports the webkit recognition constructor', t => {
  const f = setup(t, { prefixed: true });
  f.startButton.click();
  assert.equal(f.instances[0].startCalls, 1);
  assert.equal(f.controller.getMetadata().supported, true);
});

test('interim text remains separate from the answer and does not trigger confirmation invalidation', t => {
  const f = setup(t, { value: '手写：' });
  f.startButton.click();
  f.instances[0].result([['初步识别', false]]);
  assert.equal(f.textarea.value, '手写：');
  assert.match(f.interim.textContent, /初步识别/);
  assert.equal(f.changes.length, 0);
  assert.equal(f.controller.getMetadata().inputMethod, 'text');
  f.instances[0].result([['修正的识别', false]]);
  assert.match(f.interim.textContent, /修正的识别/);
  assert.doesNotMatch(f.interim.textContent, /初步识别/);
});

test('appends final results once per index while rebuilding interim results from each event', t => {
  const f = setup(t, { value: '手写：' });
  f.startButton.click();
  const r = f.instances[0];
  r.result([['第一句。', true], ['第二', false]]);
  r.result([['第一句。', true], ['第二句。', true]], 1);
  r.result([['第一句。', true], ['第二句。', true]], 0);
  assert.equal(f.textarea.value, '手写：第一句。第二句。');
  assert.equal(f.interim.textContent, '');
  assert.equal(f.changes.length, 2);
  assert.equal(f.changes[0].source, 'speech');
  assert.equal(f.controller.getMetadata().inputMethod, 'mixed');
});

test('preserves edits and deletions made during recognition without reinserting old final text', t => {
  const f = setup(t);
  f.startButton.click();
  const r = f.instances[0];
  r.result([['识别原句。', true]]);
  f.textarea.type('我修改后的文字。');
  r.result([['识别原句。', true], ['后续语音。', true]], 1);
  assert.equal(f.textarea.value, '我修改后的文字。后续语音。');
  f.textarea.type('');
  r.result([['识别原句。', true], ['后续语音。', true]], 0);
  assert.equal(f.textarea.value, '');
  assert.equal(f.controller.getMetadata().inputMethod, 'mixed');
  assert.deepEqual(f.changes.map(change => change.source), ['speech', 'text', 'speech', 'text']);
});

test('speech-only input is recorded as speech without adding punctuation or rewriting text', t => {
  const f = setup(t);
  f.startButton.click();
  f.instances[0].result([['  我认为，原话应保留 ', true]]);
  assert.equal(f.textarea.value, '  我认为，原话应保留 ');
  assert.equal(f.controller.getMetadata().inputMethod, 'speech');
});

test('stop remains busy until onend and includes the final result arriving during stopping', t => {
  const f = setup(t);
  f.startButton.click();
  const r = f.instances[0];
  f.stopButton.click();
  f.controller.stop();
  assert.equal(r.stopCalls, 1);
  assert.equal(f.controller.isBusy(), true);
  assert.equal(f.stopButton.disabled, true);
  assert.match(f.status.textContent, /停止|等待/);
  r.emit('start');
  assert.match(f.status.textContent, /停止|等待/);
  r.result([['最后一句。', true]]);
  assert.equal(f.textarea.value, '最后一句。');
  assert.equal(f.controller.isBusy(), true);
  r.emit('end');
  assert.equal(f.controller.isBusy(), false);
  assert.equal(f.startButton.disabled, false);
  assert.match(f.status.textContent, /检查/);
});

test('new session permits the same spoken phrase again but rejects stale previous callbacks', t => {
  const f = setup(t);
  f.startButton.click();
  const first = f.instances[0];
  const staleResult = first.onresult;
  const staleEnd = first.onend;
  first.result([['重复。', true]]);
  first.emit('end');
  f.startButton.click();
  f.instances[1].result([['重复。', true]]);
  staleResult({ results: [Object.assign([{ transcript: '过时内容' }], { isFinal: true })] });
  staleEnd();
  assert.equal(f.textarea.value, '重复。重复。');
  assert.equal(f.controller.isBusy(), true);
  assert.equal(f.controller.getMetadata().attempts, 2);
});

test('recognition truncates at 800 UTF-16 units, stops, and explains omitted content', t => {
  const f = setup(t, { value: '文'.repeat(798) });
  f.startButton.click();
  const r = f.instances[0];
  r.result([['甲乙丙丁', true]]);
  assert.equal(f.textarea.value, '文'.repeat(798) + '甲乙');
  assert.equal(r.stopCalls, 1);
  assert.equal(f.controller.isBusy(), true);
  assert.equal(f.controller.getMetadata().limitReached, true);
  assert.match(f.status.textContent, /800.*上限/);
  assert.match(f.status.textContent, /超出.*未写入/);
  r.emit('end');
  assert.match(f.status.textContent, /800.*上限/);
  f.textarea.type('已缩短');
  assert.equal(f.startButton.disabled, false);
});

test('truncation never splits an emoji surrogate pair', t => {
  const f = setup(t, { value: '文'.repeat(799) });
  f.startButton.click();
  f.instances[0].result([['😀其他内容', true]]);
  assert.equal(f.textarea.value, '文'.repeat(799));
  assert.equal(f.instances[0].stopCalls, 1);
  assert.equal(f.controller.getMetadata().limitReached, true);
});

test('manual input is bounded and an already-full answer cannot start microphone access', t => {
  const f = setup(t);
  f.textarea.type('字'.repeat(900));
  assert.equal(f.textarea.value.length, 800);
  assert.equal(f.changes.at(-1).value.length, 800);
  f.startButton.click();
  assert.equal(f.instances.length, 0);
  assert.match(f.status.textContent, /800.*上限/);
});

test('respects a smaller textarea maxlength and caps a larger value at 800', t => {
  const f = setup(t, { maxLength: 4 });
  f.startButton.click();
  f.instances[0].result([['一二三四五', true]]);
  assert.equal(f.textarea.value, '一二三四');
  assert.match(f.status.textContent, /4.*上限/);
  const g = setup(t, { maxLength: 1000 });
  assert.equal(g.textarea.maxLength, 800);
});

for (const [code, pattern] of [['not-allowed', /权限|允许/], ['service-not-allowed', /不允许|权限|服务/], ['network', /网络/], ['no-speech', /未检测到语音/], ['audio-capture', /麦克风/]]) {
  test(`${code} error explains fallback, preserves text, and waits for end`, t => {
    const f = setup(t, { value: '保留文字' });
    f.startButton.click();
    const r = f.instances[0];
    r.result([['临时内容', false]]);
    r.emit('error', { error: code, message: 'provider detail must not be persisted' });
    assert.match(f.status.textContent, pattern);
    assert.match(f.status.textContent, /手动输入/);
    assert.equal(f.interim.textContent, '');
    assert.equal(f.controller.isBusy(), true);
    r.emit('end');
    assert.equal(f.controller.isBusy(), false);
    assert.equal(f.textarea.value, '保留文字');
    assert.match(f.status.textContent, pattern);
    assert.deepEqual(f.controller.getMetadata().errors, [code]);
    const metadata = f.controller.getMetadata();
    metadata.errors.push('mutated-copy');
    assert.deepEqual(f.controller.getMetadata().errors, [code]);
  });
}

test('synchronous permission rejection restores typing state and records failure', t => {
  const error = new Error('not allowed');
  error.name = 'NotAllowedError';
  const f = setup(t, { startError: error });
  f.startButton.click();
  assert.equal(f.controller.isBusy(), false);
  assert.equal(f.startButton.disabled, false);
  assert.match(f.status.textContent, /权限|允许/);
  assert.equal(f.textarea.disabled, false);
  assert.deepEqual(f.controller.getMetadata().errors, ['not-allowed']);
});

test('stop failure aborts the recognition but remains busy until end', t => {
  const f = setup(t, { stopError: new Error('cannot stop') });
  f.startButton.click();
  f.controller.stop();
  assert.equal(f.instances[0].abortCalls, 1);
  assert.equal(f.controller.isBusy(), true);
  assert.deepEqual(f.controller.getMetadata().errors, ['stop-failed']);
  f.instances[0].emit('end');
  assert.equal(f.controller.isBusy(), false);
  assert.match(f.status.textContent, /已结束/);
  assert.doesNotMatch(f.status.textContent, /正在|请等待/);
});

test('pagehide releases recognition, discards late callbacks, and permits a fresh user start', t => {
  const f = setup(t);
  f.startButton.click();
  const r = f.instances[0];
  const lateResult = r.onresult;
  f.window.dispatchEvent(new Event('pagehide'));
  assert.equal(r.abortCalls, 1);
  assert.equal(f.controller.isBusy(), false);
  lateResult({ results: [Object.assign([{ transcript: '不应加入' }], { isFinal: true })] });
  assert.equal(f.textarea.value, '');
  f.startButton.click();
  assert.equal(f.instances.length, 2);
});

test('destroy is idempotent, releases the microphone and rejects all late text updates', t => {
  const f = setup(t, { value: '已有文字' });
  f.startButton.click();
  const r = f.instances[0];
  const lateResult = r.onresult;
  f.controller.destroy();
  f.controller.destroy();
  lateResult({ results: [Object.assign([{ transcript: '不应加入' }], { isFinal: true })] });
  f.startButton.click();
  f.textarea.type('之后手动输入');
  assert.equal(r.abortCalls, 1);
  assert.equal(f.instances.length, 1);
  assert.equal(f.textarea.value, '之后手动输入');
  assert.equal(f.changes.length, 0);
  assert.equal(f.controller.isBusy(), false);
});

test('stop without onend releases after five seconds and rejects stale results while preserving text', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup(t, { value: '已有文字。' });
  f.startButton.click();
  const r = f.instances[0];
  r.result([['已确认语音。', true], ['临时内容', false]]);
  const staleResult = r.onresult;
  const staleEnd = r.onend;
  f.controller.stop();
  t.mock.timers.tick(4999);
  assert.equal(f.controller.isBusy(), true);
  t.mock.timers.tick(1);
  assert.equal(f.controller.isBusy(), false);
  assert.equal(r.abortCalls, 1);
  assert.equal(f.interim.textContent, '');
  assert.equal(f.textarea.value, '已有文字。已确认语音。');
  assert.match(f.status.textContent, /已停止/);
  assert.match(f.status.textContent, /手动输入/);
  assert.equal(f.startButton.disabled, false);
  assert.deepEqual(f.controller.getMetadata().errors, ['end-timeout']);
  f.textarea.type('改用手动输入');
  f.startButton.click();
  staleResult({ results: [Object.assign([{ transcript: '迟到结果' }], { isFinal: true })] });
  staleEnd();
  assert.equal(f.textarea.value, '改用手动输入');
  assert.equal(f.controller.isBusy(), true);
});

test('recognition errors without onend have the same bounded manual fallback', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup(t, { value: '保留文字' });
  f.startButton.click();
  f.instances[0].emit('error', { error: 'network' });
  t.mock.timers.tick(5000);
  assert.equal(f.controller.isBusy(), false);
  assert.equal(f.instances[0].abortCalls, 1);
  assert.equal(f.textarea.value, '保留文字');
  assert.match(f.status.textContent, /已停止/);
  assert.deepEqual(f.controller.getMetadata().errors, ['network', 'end-timeout']);
});

test('a normal onend cancels the stop timeout so it cannot affect a later session', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup(t);
  f.startButton.click();
  const first = f.instances[0];
  f.controller.stop();
  t.mock.timers.tick(2000);
  first.emit('end');
  f.startButton.click();
  t.mock.timers.tick(5000);
  assert.equal(first.abortCalls, 0);
  assert.equal(f.instances[1].abortCalls, 0);
  assert.equal(f.controller.isBusy(), true);
  assert.deepEqual(f.controller.getMetadata().errors, []);
});

test('active recording has no timeout before stop or error', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup(t);
  f.startButton.click();
  f.instances[0].emit('start');
  t.mock.timers.tick(60000);
  assert.equal(f.controller.isBusy(), true);
  assert.equal(f.instances[0].stopCalls, 0);
  assert.equal(f.instances[0].abortCalls, 0);
  assert.deepEqual(f.controller.getMetadata().errors, []);
});

test('plain browser script exposes the StudySpeech global', () => {
  assert.ok(fs.existsSync(modulePath), 'speech-input.js must exist');
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context);
  assert.equal(typeof context.window.StudySpeech.create, 'function');
});
