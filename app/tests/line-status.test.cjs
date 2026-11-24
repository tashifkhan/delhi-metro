const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync('src/utils/lineStatus.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const lineStatus = {};
vm.runInNewContext(code, { exports: lineStatus, Set });

test("each operator's wording for a running line counts as normal", () => {
  for (const status of ['Normal Service', 'Operational', ' normal service ', 'OPERATIONAL']) {
    assert.equal(lineStatus.isLineNormal(status), true, status);
  }
});

test('anything else is a disruption, including a missing status', () => {
  for (const status of ['Delayed due to signalling issue', 'Services suspended', '', null, undefined]) {
    assert.equal(lineStatus.isLineNormal(status), false, String(status));
  }
});
