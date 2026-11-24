const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync('src/theme/useAdaptedStyles.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = {};
vm.runInNewContext(code, { exports: mod, require: () => ({ useMemo: (f) => f(), useAppTheme: () => ({}) }), Object });

const studio = { style: 'studio', radius: { badge: 4, iconSmall: 6, icon: 7, card: 7, hero: 10, field: 7, pill: 999 } };
const plain = { style: 'plain', radius: { badge: 0, iconSmall: 2, icon: 2, card: 2, hero: 2, field: 2, pill: 2 } };

test('Material keeps its corners; Studio and Plain map them by size', () => {
  const sheet = { card: { borderRadius: 28 }, tile: { borderRadius: 16 }, chip: { borderRadius: 8 } };
  assert.equal(mod.adaptStyles(sheet, { style: 'material' }), sheet);
  const s = mod.adaptStyles(sheet, studio);
  assert.equal(s.card.borderRadius, 10);
  assert.equal(s.tile.borderRadius, 7);
  assert.equal(s.chip.borderRadius, 4);
  assert.equal(mod.adaptStyles(sheet, plain).card.borderRadius, 2);
});

test('dots and station markers stay round', () => {
  const sheet = { dot: { width: 8, height: 8, borderRadius: 4 }, marker: { width: 20, height: 20, borderRadius: 10 } };
  const s = mod.adaptStyles(sheet, plain);
  assert.equal(s.dot.borderRadius, 4);
  assert.equal(s.marker.borderRadius, 10);
});
