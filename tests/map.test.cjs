const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('src/features/map/utils.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(output, { module: moduleValue, exports: moduleValue.exports, require });
const { mappedItems } = moduleValue.exports;

const item = (overrides = {}) => ({
  type: 'journey', id: '1', journey_id: '1', latitude: '42.662900', longitude: '21.165500',
  title: 'Prishtina', subtitle: null, date: null, thumbnail_url: null, caption: null, ...overrides,
});

test('maps valid coordinates and preserves every type for the all filter', () => {
  const result = mappedItems([item(), item({ type: 'memory', id: '2' }), item({ type: 'photo', id: '3' })], 'all');
  assert.equal(result.length, 3);
  assert.deepEqual({ ...result[0].coordinate }, { latitude: 42.6629, longitude: 21.1655 });
});

test('filters map items by type', () => {
  const result = mappedItems([item(), item({ type: 'memory', id: '2' }), item({ type: 'photo', id: '3' })], 'memory');
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'memory');
});

test('drops incomplete, non-numeric, and out-of-range coordinates', () => {
  const result = mappedItems([
    item({ id: 'blank', latitude: '' }), item({ id: 'nan', longitude: 'west' }),
    item({ id: 'latitude', latitude: '91' }), item({ id: 'longitude', longitude: '-181' }),
  ], 'all');
  assert.equal(result.length, 0);
});
