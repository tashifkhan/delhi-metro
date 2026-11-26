const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/hooks/useSidebarWidth.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

test('navigation adapts to folding and window resizing', () => {
  const exports = {};
  let dimensions = { width: 466, height: 678 };
  vm.runInNewContext(code, {
    exports,
    require: () => ({ useWindowDimensions: () => dimensions }),
  });

  assert.equal(exports.useSidebarWidth(), 0);
  dimensions = { width: 669, height: 951 };
  assert.equal(exports.useSidebarWidth(), 216);
  dimensions = { width: 1024, height: 768 };
  assert.equal(exports.useSidebarWidth(), 272);
  dimensions = { width: 669, height: 400 };
  assert.equal(exports.useSidebarWidth(), 216);
  dimensions = { width: 599, height: 951 };
  assert.equal(exports.useSidebarWidth(), 0);
});
