const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const VERBS = ['navigate', 'select', 'toggle', 'press', 'success', 'warning', 'error'];

function evaluate(path, requireFn, sandbox = {}) {
  const source = fs.readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: requireFn, ...sandbox });
  return exports;
}

/** The policy layer is shared, so each driver is tested behind the real one. */
function loadPolicy(driver, now) {
  const effects = evaluate('src/hooks/hapticEffects.ts', () => {});
  return evaluate('src/hooks/useHaptics.ts', name => (name === './hapticsDriver' ? driver : effects), {
    Date: { now },
  }).useHaptics();
}

function loadHaptics(os = 'ios', failure) {
  const calls = [];
  let now = 1000;
  const native = { Platform: { OS: os }, AppState: { currentState: 'active' } };
  const enums = new Proxy({}, { get: (_, key) => key });
  const expo = { AndroidHaptics: enums, ImpactFeedbackStyle: enums, NotificationFeedbackType: enums };
  for (const method of ['impactAsync', 'selectionAsync', 'notificationAsync', 'performAndroidHapticsAsync']) {
    expo[method] = (...args) => {
      calls.push([method, ...args]);
      if (failure === 'throw') throw new Error('Unavailable');
      return failure === 'reject' ? Promise.reject(new Error('Unavailable')) : Promise.resolve();
    };
  }
  const driver = evaluate('src/hooks/hapticsDriver.ts', name => (name === 'react-native' ? native : expo));
  return { feedback: loadPolicy(driver, () => now), calls, native, advance: (ms) => { now += ms; } };
}

function loadWebHaptics({ hidden = false, reduceMotion = false, failure } = {}) {
  const patterns = [];
  let now = 1000;
  let options;
  let cancels = 0;
  const listeners = {};
  class WebHaptics {
    constructor(given) { options = given; }
    trigger(input) {
      patterns.push(input);
      if (failure === 'throw') throw new Error('Unavailable');
      return failure === 'reject' ? Promise.reject(new Error('Unavailable')) : Promise.resolve();
    }
    cancel() { cancels++; }
  }
  const document = {
    visibilityState: hidden ? 'hidden' : 'visible',
    hidden,
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  const window = { matchMedia: query => ({ matches: reduceMotion && query.includes('reduce') }) };
  const driver = evaluate('src/hooks/hapticsDriver.web.ts', name => (name === 'web-haptics' ? { WebHaptics } : {}), {
    document,
    window,
  });
  return {
    feedback: loadPolicy(driver, () => now),
    patterns,
    listeners,
    document,
    advance: ms => { now += ms; },
    get options() { return options; },
    get cancels() { return cancels; },
  };
}

test('iOS uses selection feedback and distinct navigation, commitment, and outcome patterns', () => {
  const { feedback: h, calls, advance } = loadHaptics();
  h.navigate(); advance(100); h.select(); advance(100); h.press(); advance(100); h.success();
  assert.deepEqual(calls, [ ['impactAsync', 'Soft'], ['selectionAsync'], ['impactAsync', 'Medium'], ['notificationAsync', 'Success'] ]);
});

test('Android uses native presets for every intent', () => {
  const { feedback: h, calls, advance } = loadHaptics('android');
  for (const act of [h.navigate, h.select, () => h.toggle(true), () => h.toggle(false), h.press, h.success, h.warning, h.error]) {
    act(); advance(500);
  }
  assert.deepEqual(calls.map(c => c[1]), ['Clock_Tick', 'Segment_Tick', 'Toggle_On', 'Toggle_Off', 'Virtual_Key', 'Confirm', 'Reject', 'Reject']);
  assert.ok(calls.every(c => c[0] === 'performAndroidHapticsAsync'));
});

test('navigation never uses the tick a device is allowed to drop', () => {
  const { feedback: h, calls } = loadHaptics('android');
  h.navigate();
  assert.notEqual(calls[0][1], 'Segment_Frequent_Tick');
});

test('background apps stay silent', () => {
  for (const os of ['ios', 'android']) {
    const { feedback: h, native, calls } = loadHaptics(os);
    native.AppState.currentState = 'background';
    for (const verb of VERBS) h[verb](true);
    assert.equal(calls.length, 0);
  }
});

test('rapid taps coalesce without suppressing an immediate outcome', () => {
  const { feedback: h, calls, advance } = loadHaptics();
  h.select(); h.press(); advance(79); h.navigate();
  assert.equal(calls.length, 1);
  advance(1); h.press(); h.error();
  assert.equal(calls.length, 3);
  h.error(); advance(399); h.select();
  assert.equal(calls.length, 3);
  advance(1); h.select();
  assert.equal(calls.length, 4);
});

test('turning a switch off feels lighter than turning it on', () => {
  const { feedback: h, calls, advance } = loadHaptics();
  h.toggle(true); advance(100); h.toggle(false);
  assert.deepEqual(calls, [['impactAsync', 'Light'], ['selectionAsync']]);
});

for (const failure of ['throw', 'reject']) {
  test(`native ${failure} never escapes the interaction`, async () => {
    const { feedback: h } = loadHaptics('ios', failure);
    assert.doesNotThrow(() => h.press());
    await new Promise(resolve => setImmediate(resolve));
  });

  test(`web ${failure} never escapes the interaction`, async () => {
    const { feedback: h } = loadWebHaptics({ failure });
    assert.doesNotThrow(() => h.press());
    await new Promise(resolve => setImmediate(resolve));
  });
}

test('the web covers the same vocabulary as native', () => {
  const { feedback: h, patterns, advance } = loadWebHaptics();
  for (const verb of VERBS) { h[verb](true); advance(500); }
  assert.equal(patterns.length, VERBS.length);
  assert.ok(patterns.every(pattern => Array.isArray(pattern) && pattern.length > 0));
});

test('web pulses carry weight as duration, never as a simulated amplitude', () => {
  const { feedback: h, patterns, advance } = loadWebHaptics();
  for (const verb of VERBS) { h[verb](true); advance(500); }
  const beats = patterns.flat();
  assert.ok(beats.every(beat => beat.intensity === 1));
  // Beyond one 16ms fallback interval a single tap starts to rattle.
  assert.ok(beats.every(beat => beat.duration > 0 && beat.duration <= 16));
});

test('web weight grows with intent and only outcomes get a second beat', () => {
  const { feedback: h, patterns, advance } = loadWebHaptics();
  for (const act of [h.navigate, h.select, () => h.toggle(false), () => h.toggle(true), h.press]) {
    act(); advance(500);
  }
  const taps = patterns.map(pattern => pattern.map(beat => beat.duration));
  assert.ok(taps.every(tap => tap.length === 1));
  const weights = taps.flat();
  assert.deepEqual(weights, [...weights].sort((a, b) => a - b));

  patterns.length = 0;
  for (const act of [h.success, h.warning, h.error]) { act(); advance(500); }
  assert.ok(patterns.every(pattern => pattern.length === 2 && pattern[1].delay > 0));
  // The whole pattern has to land inside the 400ms outcome quiet window.
  const spans = patterns.map(p => p.reduce((total, beat) => total + beat.duration + (beat.delay ?? 0), 0));
  assert.ok(spans.every(span => span < 400));
});

test('a web outcome clears the tap that asked for it', () => {
  const web = loadWebHaptics();
  web.feedback.press();
  assert.equal(web.cancels, 0);
  web.advance(10);
  web.feedback.success();
  assert.equal(web.cancels, 1);
  assert.equal(web.patterns.length, 2);
});

test('hidden pages and reduced motion stay silent on the web', () => {
  for (const options of [{ hidden: true }, { reduceMotion: true }]) {
    const { feedback: h, patterns, advance } = loadWebHaptics(options);
    for (const verb of VERBS) { h[verb](true); advance(500); }
    assert.equal(patterns.length, 0);
  }
});

test('leaving the tab stops a web pattern mid-flight', () => {
  const web = loadWebHaptics();
  web.feedback.press();
  web.document.hidden = true;
  web.listeners.visibilitychange();
  assert.equal(web.cancels, 1);
});

test('the web engine never shows its own switch or plays audible clicks', () => {
  const web = loadWebHaptics();
  web.feedback.press();
  // Debug adds an audible click track, and the switch is the library's own
  // floating control; both belong to its demo, not to a shipped app.
  assert.equal(web.options.debug, false);
  assert.equal(web.options.showSwitch, false);
});

function renderTouchable(props) {
  const pulses = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useCallback: fn => fn,
    useRef: value => ({ current: value }),
  };
  const mocks = {
    react: React,
    'react-native': { Animated: { Value: class {} }, StyleSheet: { create: value => value }, View: 'View' },
    'react-native-paper': { TouchableRipple: 'Ripple', useTheme: () => ({ colors: { onSurface: '#000' } }) },
    '../theme': { radius: { card: 12 }, tint: value => value },
    '../theme/motion': {},
    '../hooks/useHaptics': { useHaptics: () => Object.fromEntries(['navigate', 'select', 'press'].map(key => [key, () => pulses.push(key)])) },
  };
  const source = fs.readFileSync('src/components/Touchable.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, React, require: name => mocks[name] });
  const tree = exports.Touchable({ children: null, ...props });
  return { ripple: tree.props.children[0], pulses };
}

test('disabled and noninteractive touchables cannot emit feedback or invoke actions', () => {
  let actions = 0;
  for (const props of [{ disabled: true, onPress: () => actions++ }, {}]) {
    const { ripple, pulses } = renderTouchable(props);
    ripple.props.onPress();
    assert.equal(pulses.length, 0);
  }
  assert.equal(actions, 0);
});

test('already selected options stay silent but still allow their action', () => {
  let actions = 0;
  const { ripple, pulses } = renderTouchable({ haptic: 'select', accessibilityState: { selected: true }, onPress: () => actions++ });
  ripple.props.onPress();
  assert.equal(pulses.length, 0);
  assert.equal(actions, 1);
});

test('navigation gets one soft tap and handler-owned feedback opts out', () => {
  for (const haptic of [undefined, false, 'press']) {
    const { ripple, pulses } = renderTouchable({ haptic, onPress: () => {} });
    ripple.props.onPress();
    assert.deepEqual(pulses, haptic === false ? [] : [haptic ?? 'navigate']);
  }
});

test('denied photo permission cannot report a saved map', async () => {
  const code = ts.transpileModule(fs.readFileSync('src/services/mapDownload.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  let downloaded = false;
  const mocks = {
    'react-native': { Alert: { alert: () => {} } },
    'expo-file-system/legacy': { downloadAsync: async () => { downloaded = true; } },
    'expo-media-library': { requestPermissionsAsync: async () => ({ granted: false }) },
  };
  vm.runInNewContext(code, { exports, require: name => mocks[name] });
  const result = await exports.saveNetworkMap({ downloadUrl: 'https://example.com/map.jpg', extension: 'jpg', network: 'dmrc', networkName: 'Delhi Metro' });
  assert.equal(result, 'permission-denied');
  assert.equal(downloaded, false);
});
