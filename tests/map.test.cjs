const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('src/features/map/utils.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(output, { module: moduleValue, exports: moduleValue.exports, require });
const {
  clusterExpansionRegion,
  mapItemDayNumber,
  mapItemKey,
  mappedItems,
  prepareMapMarkers,
  selectedItemForFilter,
} = moduleValue.exports;

const item = (overrides = {}) => ({
  type: 'journey', id: '1', journey_id: '1', latitude: '42.662900', longitude: '21.165500',
  title: 'Prishtina', subtitle: null, date: null, thumbnail_url: null, thumbnail_revision: null, caption: null,
  location: null, journey_start_date: '2025-03-12', journey_end_date: '2025-03-19',
  memory_id: null, memory_title: null, ...overrides,
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

test('clusters mixed markers and keeps the rendered marker count bounded', () => {
  const source = Array.from({ length: 500 }, (_, index) => item({
    id: String(index),
    type: index % 3 === 0 ? 'journey' : index % 3 === 1 ? 'memory' : 'photo',
    latitude: String(42.64 + (index % 25) * 0.001),
    longitude: String(21.14 + Math.floor(index / 25) * 0.001),
  }));
  const mapped = mappedItems(source, 'all');
  const markers = prepareMapMarkers(
    mapped,
    { latitude: 42.66, longitude: 21.16, latitudeDelta: 0.1, longitudeDelta: 0.1 },
    390,
    844,
  );
  assert.ok(markers.length < 100);
  assert.equal(markers.reduce((count, marker) => count + (marker.kind === 'cluster' ? marker.items.length : 1), 0), 500);
});

test('filters immediately invalidate a selection that is no longer visible', () => {
  const all = mappedItems([item(), item({ type: 'memory', id: '2' })], 'all');
  const memories = mappedItems(all, 'memory');
  assert.equal(selectedItemForFilter(mapItemKey(all[0]), memories), null);
  assert.equal(selectedItemForFilter(mapItemKey(all[1]), memories).id, '2');
});

test('cluster zooms until close range then exposes overlapping items', () => {
  const mapped = mappedItems([
    item({ id: 'a' }),
    item({ id: 'b', type: 'photo', latitude: '42.662901', longitude: '21.165501' }),
  ], 'all');
  const region = { latitude: 42.6629, longitude: 21.1655, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  const cluster = prepareMapMarkers(mapped, region, 390, 844)[0];
  assert.equal(cluster.kind, 'cluster');
  assert.ok(clusterExpansionRegion(cluster, region).latitudeDelta < region.latitudeDelta);
  assert.equal(clusterExpansionRegion(cluster, { ...region, latitudeDelta: 0.003, longitudeDelta: 0.003 }), null);
});

test('viewport preparation includes dateline-adjacent coordinates', () => {
  const mapped = mappedItems([
    item({ id: 'east', longitude: '179.9' }),
    item({ id: 'west', longitude: '-179.9' }),
  ], 'all');
  const markers = prepareMapMarkers(
    mapped,
    { latitude: 42.6629, longitude: 180, latitudeDelta: 1, longitudeDelta: 1 },
    390,
    844,
  );
  assert.equal(markers.reduce((count, marker) => count + (marker.kind === 'cluster' ? marker.items.length : 1), 0), 2);
});

test('map metadata calculates stable journey day numbers', () => {
  assert.equal(mapItemDayNumber(item({ date: '2025-03-15' })), 4);
  assert.equal(mapItemDayNumber(item({ date: null })), null);
});
