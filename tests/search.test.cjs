const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('src/features/search/utils.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(output, { module: moduleValue, exports: moduleValue.exports, require });
const {
  addRecentSearch, groupSearchResults, normalizeRecentSearches, normalizeSearchQuery,
  resultMetadata, searchNavigationTarget,
} = moduleValue.exports;

test('normalizes query whitespace without changing its words', () => {
  assert.equal(normalizeSearchQuery('  Medina   mosque  '), 'Medina mosque');
});

test('recent searches deduplicate case-insensitively with newest first', () => {
  assert.deepEqual(Array.from(addRecentSearch(['Milan', 'Medina'], '  MILAN ')), ['MILAN', 'Medina']);
});

test('recent searches retain only five valid queries', () => {
  let recent = [];
  for (const query of ['one', 'two', 'three', 'four', 'five', 'six']) recent = addRecentSearch(recent, query);
  assert.deepEqual(Array.from(recent), ['six', 'five', 'four', 'three', 'two']);
  assert.deepEqual(Array.from(normalizeRecentSearches(['Medina', 'medina', '', 4])), ['Medina']);
});

test('groups results and omits empty sections', () => {
  const journey = { type: 'journey', id: 'j' };
  const photo = { type: 'photo', id: 'p' };
  const sections = groupSearchResults({ query: 'x', journeys: [journey], memories: [], photos: [photo] });
  assert.deepEqual(Array.from(sections, (section) => section.title), ['Journeys', 'Photos']);
});

test('formats result metadata and stable journey day numbers', () => {
  assert.equal(resultMetadata({ type: 'journey', destination: 'Medina', country: 'Saudi Arabia' }), 'Medina, Saudi Arabia');
  assert.equal(resultMetadata({ type: 'memory', journey_title: 'Pilgrimage', journey_start_date: '2025-03-12', date: '2025-03-14' }), 'Pilgrimage · Day 3');
  assert.equal(resultMetadata({ type: 'photo', journey_title: 'Milan', memory_title: 'Duomo' }), 'Milan · Duomo');
});

test('builds existing navigation targets for every result type', () => {
  assert.equal(JSON.stringify(searchNavigationTarget({ type: 'journey', id: 'j' })), JSON.stringify({ pathname: '/journey/[id]', params: { id: 'j' } }));
  assert.equal(JSON.stringify(searchNavigationTarget({ type: 'memory', id: 'm', journey_id: 'j' })), JSON.stringify({ pathname: '/journey/[id]', params: { id: 'j', memoryId: 'm' } }));
  assert.equal(JSON.stringify(searchNavigationTarget({ type: 'photo', id: 'p', journey_id: 'j' })), JSON.stringify({ pathname: '/journey/[id]/photo/[mediaId]', params: { id: 'j', mediaId: 'p' } }));
});
