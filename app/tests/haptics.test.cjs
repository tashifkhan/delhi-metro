const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const VERBS = ['navigate', 'select', 'toggle', 'press', 'longPress', 'success', 'warning', 'error'];

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
  });
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
  const policy = loadPolicy(driver, () => now);
  return {
    feedback: policy.useHaptics(),
    setEnabled: policy.setHapticsEnabled,
    calls,
    native,
    advance: ms => { now += ms; },
  };
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
  const policy = loadPolicy(driver, () => now);
  return {
    feedback: policy.useHaptics(),
    setEnabled: policy.setHapticsEnabled,
    patterns,
    listeners,
    document,
    advance: ms => { now += ms; },
    get options() { return options; },
    get cancels() { return cancels; },
  };
}

test('routine navigation, selection, and presses stay silent on every platform', () => {
  for (const platform of [loadHaptics(), loadHaptics('android'), loadWebHaptics()]) {
    for (const verb of ['navigate', 'select', 'press']) {
      platform.feedback[verb](); platform.advance(1000);
    }
    assert.equal((platform.calls ?? platform.patterns).length, 0);
    platform.feedback.success();
    assert.equal((platform.calls ?? platform.patterns).length, 1);
  }
});

test('iOS uses selection ticks for switches and soft single impacts otherwise', () => {
  const { feedback: h, calls, advance } = loadHaptics();
  for (const act of [() => h.toggle(true), () => h.toggle(false), h.longPress, h.success, h.warning, h.error]) {
    act(); advance(1000);
  }
  assert.deepEqual(calls, [
    ['selectionAsync'], ['selectionAsync'],
    ...Array.from({ length: 4 }, () => ['impactAsync', 'Soft']),
  ]);
});

test('Android uses the soft system tick for retained feedback', () => {
  const { feedback: h, calls, advance } = loadHaptics('android');
  for (const act of [() => h.toggle(true), () => h.toggle(false), h.longPress, h.success, h.warning, h.error]) {
    act(); advance(1000);
  }
  assert.deepEqual(calls, Array.from({ length: 6 }, () => ['performAndroidHapticsAsync', 'Segment_Frequent_Tick']));
});

test('background apps stay silent', () => {
  for (const os of ['ios', 'android']) {
    const { feedback: h, native, calls } = loadHaptics(os);
    native.AppState.currentState = 'background';
    for (const verb of VERBS) h[verb](true);
    assert.equal(calls.length, 0);
  }
});

test('disabling the haptics preference silences every effect until re-enabled', () => {
  const { feedback: h, setEnabled, calls, advance } = loadHaptics();
  setEnabled(false);
  for (const verb of VERBS) { h[verb](true); advance(1000); }
  assert.equal(calls.length, 0);

  setEnabled(true);
  h.longPress();
  assert.equal(calls.length, 1);
});

test('the haptics preference also gates the web driver', () => {
  const web = loadWebHaptics();
  web.setEnabled(false);
  for (const verb of VERBS) { web.feedback[verb](true); web.advance(1000); }
  assert.equal(web.patterns.length, 0);

  web.setEnabled(true);
  web.feedback.longPress();
  assert.equal(web.patterns.length, 1);
});

test('rapid feedback coalesces and outcomes get a longer quiet window', () => {
  const { feedback: h, calls, advance } = loadHaptics();
  h.toggle(true); h.longPress(); advance(249); h.toggle(false);
  assert.equal(calls.length, 1);
  advance(1); h.longPress(); h.error();
  assert.equal(calls.length, 3);
  h.error(); advance(599); h.toggle(true);
  assert.equal(calls.length, 3);
  advance(1); h.toggle(false);
  assert.equal(calls.length, 4);
});

for (const failure of ['throw', 'reject']) {
  test(`native ${failure} never escapes the interaction`, async () => {
    const { feedback: h } = loadHaptics('ios', failure);
    assert.doesNotThrow(() => h.longPress());
    await new Promise(resolve => setImmediate(resolve));
  });

  test(`web ${failure} never escapes the interaction`, async () => {
    const { feedback: h } = loadWebHaptics({ failure });
    assert.doesNotThrow(() => h.longPress());
    await new Promise(resolve => setImmediate(resolve));
  });
}

test('the web covers the same vocabulary as native', () => {
  const { feedback: h, patterns, advance } = loadWebHaptics();
  for (const verb of VERBS) { h[verb](true); advance(1000); }
  assert.equal(patterns.length, VERBS.length - 3);
  assert.ok(patterns.every(pattern => Array.isArray(pattern) && pattern.length > 0));
});

test('web pulses carry weight as duration, never as a simulated amplitude', () => {
  const { feedback: h, patterns, advance } = loadWebHaptics();
  for (const verb of VERBS) { h[verb](true); advance(1000); }
  const beats = patterns.flat();
  assert.ok(beats.every(beat => beat.intensity === 1));
  // Beyond one 16ms fallback interval a single tap starts to rattle.
  assert.ok(beats.every(beat => beat.duration > 0 && beat.duration <= 6));
});

test('every retained web effect is a short single pulse', () => {
  const { feedback: h, patterns, advance } = loadWebHaptics();
  for (const act of [() => h.toggle(false), () => h.toggle(true), h.longPress, h.success, h.warning, h.error]) {
    act(); advance(1000);
  }
  assert.deepEqual(patterns.map(p => Array.from(p, beat => beat.duration)), [[4], [4], [6], [6], [6], [6]]);
});

test('a web outcome clears the tap that asked for it', () => {
  const web = loadWebHaptics();
  web.feedback.longPress();
  assert.equal(web.cancels, 0);
  web.advance(10);
  web.feedback.success();
  assert.equal(web.cancels, 1);
  assert.equal(web.patterns.length, 2);
});

test('hidden pages and reduced motion stay silent on the web', () => {
  for (const options of [{ hidden: true }, { reduceMotion: true }]) {
    const { feedback: h, patterns, advance } = loadWebHaptics(options);
    for (const verb of VERBS) { h[verb](true); advance(1000); }
    assert.equal(patterns.length, 0);
  }
});

test('leaving the tab stops a web pattern mid-flight', () => {
  const web = loadWebHaptics();
  web.feedback.longPress();
  web.document.hidden = true;
  web.listeners.visibilitychange();
  assert.equal(web.cancels, 1);
});

test('the web engine never shows its own switch or plays audible clicks', () => {
  const web = loadWebHaptics();
  web.feedback.longPress();
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
    '../hooks/useHaptics': {
      useHaptics: () => Object.fromEntries(
        ['navigate', 'select', 'press', 'longPress'].map(key => [key, () => pulses.push(key)]),
      ),
    },
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

test('touchables forward intent and handler-owned feedback opts out', () => {
  for (const haptic of [undefined, false, 'press']) {
    const { ripple, pulses } = renderTouchable({ haptic, onPress: () => {} });
    ripple.props.onPress();
    assert.deepEqual(pulses, haptic === false ? [] : [haptic ?? 'navigate']);
  }
});

test('a long press requests feedback unless the handler owns it', () => {
  let actions = 0;
  for (const haptic of [undefined, false]) {
    const { ripple, pulses } = renderTouchable({ haptic, onPress: () => {}, onLongPress: () => actions++ });
    ripple.props.onLongPress();
    assert.deepEqual(pulses, haptic === false ? [] : ['longPress']);
  }
  assert.equal(actions, 2);
});

test('a touchable given no long press handler leaves the gesture alone', () => {
  const { ripple } = renderTouchable({ onPress: () => {} });
  assert.equal(ripple.props.onLongPress, undefined);
});

test('a disabled touchable ignores a long press', () => {
  let actions = 0;
  const { ripple, pulses } = renderTouchable({ disabled: true, onPress: () => {}, onLongPress: () => actions++ });
  ripple.props.onLongPress();
  assert.equal(pulses.length, 0);
  assert.equal(actions, 0);
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
