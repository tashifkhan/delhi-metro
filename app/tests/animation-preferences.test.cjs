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
const colorMath = evaluate('src/theme/colorMath.ts', () => {});
const studio = evaluate('src/theme/studio.ts', (name) => {
  if (name === './colorMath') return colorMath;
  throw new Error(`Unexpected module ${name}`);
});

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
      if (name === '../theme/studio') return studio;
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

for (const platform of ['native', 'web']) {
  test(`${platform} defaults to the Studio style in teal and keeps a saved style`, async () => {
    assert.deepEqual(
      await repository(platform).loadModule().load().then((s) => [s.uiStyle, s.studioColor]),
      ['studio', 'teal'],
    );
    const { loadModule } = repository(platform, { uiStyle: 'plain', studioColor: 'rose' });
    const loaded = await loadModule().load();
    assert.equal(loaded.uiStyle, 'plain');
    assert.equal(loaded.studioColor, 'rose');
  });

  test(`${platform} ignores an unknown style or colour`, async () => {
    const { loadModule } = repository(platform, { uiStyle: 'neon', studioColor: 'lime' });
    const loaded = await loadModule().load();
    assert.equal(loaded.uiStyle, 'studio');
    assert.equal(loaded.studioColor, 'teal');
  });
}

test('Studio and Plain schemes use the taf.sh tokens', () => {
  const combo = studio.studioComboFromId('teal');
  const light = studio.buildStudioScheme('studio', combo, false);
  assert.equal(light.background, '#f6f1e9');
  assert.equal(light.primary, '#0f7a6c');
  const dark = studio.buildStudioScheme('studio', combo, true);
  assert.equal(dark.background, '#0e0d0d');
  assert.equal(dark.primary, '#4fd1c5');
  const plain = studio.buildStudioScheme('plain', combo, false);
  assert.equal(plain.primary, '#171615');
  assert.equal(plain.surface, plain.background);
});
