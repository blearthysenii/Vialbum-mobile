const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('src/features/media/utils.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(output, { module: moduleValue, exports: moduleValue.exports });
const { photoDayNumber } = moduleValue.exports;

test('capture date changes move a photo to the corresponding journey day', () => {
  assert.equal(photoDayNumber('2025-03-12', '2025-03-18T15:30:00Z', '2025-03-14T10:00:00Z'), 7);
  assert.equal(photoDayNumber('2025-03-12', null, '2025-03-14T10:00:00Z'), 3);
});
