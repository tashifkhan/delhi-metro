const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function evaluate(path, requireFn) {
  const exports = {};
  const source = fs.readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports, require: requireFn });
  return exports;
}

const preferences = evaluate('src/theme/animationPreferences.ts', () => {});

function repository(platform, stored = {}) {
  const rows = new Map(Object.entries(stored));
  let document = { ...stored };
  const db = {
    getAllAsync: async () => [...rows].map(([key, value]) => ({ key, value: String(value) })),
    runAsync: async (_sql, key, value) => { rows.set(key, value); },
    withTransactionAsync: async (fn) => fn(),
  };
  const loadModule = () => evaluate(
    `src/storage/appSettingsRepository${platform === 'web' ? '.web' : ''}.ts`,
    (name) => {
      if (name.includes('animationPreferences')) return preferences;
      if (name.includes('palettes')) return { DEFAULT_PALETTE_ID: 'metro' };
      if (name === './database') return { getDb: () => db };
      if (name === './webStore') return {
        readJson: () => document,
        writeJson: (_key, value) => { document = JSON.parse(JSON.stringify(value)); },
      };
      throw new Error(`Unexpected module ${name}`);
    },
  ).appSettingsRepository;
  return { loadModule };
}

for (const platform of ['native', 'web']) {
  test(`${platform} upgrades old preferences without changing the theme or haptics`, async () => {
    const { loadModule } = repository(platform, {
      themeMode: 'dark', paletteId: 'forest', hapticsEnabled: false,
    });
    const settings = await loadModule().load();
    assert.equal(settings.animationStyle, 'slide');
    assert.equal(settings.themeMode, 'dark');
    assert.equal(settings.paletteId, 'forest');
    assert.equal(settings.hapticsEnabled, false);
  });

  for (const animationStyle of ['fade', 'none']) {
    test(`${platform} restores ${animationStyle} after reopening the settings repository`, async () => {
      const { loadModule } = repository(platform);
      const first = loadModule();
      await first.save({ ...await first.load(), animationStyle });
      assert.equal((await loadModule().load()).animationStyle, animationStyle);
    });
  }

  test(`${platform} falls back to Slide for an unknown stored animation`, async () => {
    const { loadModule } = repository(platform, { animationStyle: 'spin' });
    assert.equal((await loadModule().load()).animationStyle, 'slide');
  });
}

test('Reduce Motion overrides every animation preference without changing the saved choice', () => {
  for (const style of ['slide', 'fade', 'none']) {
    const active = preferences.animationPreference(style, true);
    assert.equal(active.style, 'none');
    assert.equal(active.stack, 'none');
    assert.equal(active.tabs, 'none');
  }
  assert.equal(preferences.animationPreference('fade', false).stack, 'fade');
  assert.equal(preferences.animationPreference('slide', false).tabs, 'shift');
});
