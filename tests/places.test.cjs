const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('src/features/places/utils.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(output, { module: moduleValue, exports: moduleValue.exports, require });
const { canSearchPlaces, formatPlaceContext } = moduleValue.exports;

const place = (values = {}) => ({
  name: 'Medina', locality: 'Medina', region: 'Al Madinah', country: 'Saudi Arabia', ...values,
});

test('requires two non-whitespace characters before searching', () => {
  assert.equal(canSearchPlaces(' M '), false);
  assert.equal(canSearchPlaces(' Mi '), true);
  assert.equal(canSearchPlaces('  '), false);
});

test('formats distinguishing place context without repeating the name', () => {
  assert.equal(formatPlaceContext(place()), 'Al Madinah, Saudi Arabia');
  assert.equal(formatPlaceContext(place({ name: 'Springfield', locality: 'Sangamon County', region: 'Illinois', country: 'United States' })), 'Sangamon County, Illinois, United States');
});
