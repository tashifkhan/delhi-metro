const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

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
  const source = fs.readFileSync('src/hooks/useHaptics.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => name === 'react-native' ? native : expo,
    Date: { now: () => now },
  });
  return { feedback: exports.useHaptics(), calls, native, advance: (ms) => { now += ms; } };
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
  assert.deepEqual(calls.map(c => c[1]), ['Segment_Frequent_Tick', 'Segment_Tick', 'Toggle_On', 'Toggle_Off', 'Virtual_Key', 'Confirm', 'Reject', 'Reject']);
  assert.ok(calls.every(c => c[0] === 'performAndroidHapticsAsync'));
});

test('web and background apps stay silent', () => {
  for (const os of ['web', 'ios', 'android']) {
    const { feedback: h, native, calls } = loadHaptics(os);
    if (os !== 'web') native.AppState.currentState = 'background';
    h.navigate(); h.select(); h.toggle(true); h.press(); h.success(); h.warning(); h.error();
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
}

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
