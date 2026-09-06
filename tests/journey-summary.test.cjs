const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function load(source, requireValue = require) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleValue = { exports: {} };
  vm.runInNewContext(output, { module: moduleValue, exports: moduleValue.exports, require: requireValue });
  return moduleValue.exports;
}

const timeline = load(fs.readFileSync('src/features/timeline/groupTimeline.ts', 'utf8'));
const summary = load(
  fs.readFileSync('src/features/journeys/summary.ts', 'utf8'),
  (name) => name.includes('timeline/groupTimeline') ? timeline : require(name),
);
const {
  deriveJourneySummary,
  journeyTimelineStats,
} = summary;

const journey = (values = {}) => ({
  id: 'journey', title: 'Medina', destination: 'Medina', country: 'Saudi Arabia',
  start_date: '2025-03-01', end_date: '2025-03-07', description: null,
  latitude: null, longitude: null, place_id: 'place-a', place: null,
  cover_media_id: null, cover_media_url: null, created_at: '', updated_at: '', ...values,
});
const memory = (id, date, values = {}) => ({
  id, journey_id: 'journey', title: `Memory ${id}`, caption: null, memory_date: date,
  latitude: null, longitude: null, place_id: null, place: null,
  created_at: `${date}T09:00:00Z`, updated_at: '', ...values,
});
const photo = (id, date, values = {}) => ({
  id, journey_id: 'journey', memory_id: null, place_id: null, place: null, type: 'photo',
  url: `https://example.test/${id}`, thumbnail_url: `https://example.test/thumb-${id}`,
  original_filename: `${id}.jpg`, mime_type: 'image/jpeg', file_size: 1, width: 100, height: 100,
  captured_at: `${date}T10:00:00Z`, latitude: null, longitude: null, sort_order: 0,
  caption: null, created_at: `${date}T10:00:00Z`, ...values,
});

test('calculates inclusive durations for one, seven, and thirty day journeys', () => {
  assert.equal(deriveJourneySummary(journey({ end_date: '2025-03-01' }), [], []).durationDays, 1);
  assert.equal(deriveJourneySummary(journey(), [], []).durationDays, 7);
  assert.equal(deriveJourneySummary(journey({ end_date: '2025-03-30' }), [], []).durationDays, 30);
});

test('derives counts, places, mapped content, dates, and populated Day N range', () => {
  const memories = [
    memory('m1', '2025-03-02', { place_id: 'place-b', latitude: '1', longitude: '2' }),
    memory('m2', '2025-03-06', { place_id: 'place-b' }),
  ];
  const photos = [
    photo('p1', '2025-03-03', { place_id: 'place-c', latitude: '3', longitude: '4' }),
    photo('p2', '2025-03-06', { place_id: 'place-c' }),
  ];
  const result = deriveJourneySummary(journey(), memories, photos);
  assert.deepEqual(
    {
      durationDays: result.durationDays, populatedDays: result.populatedDays,
      memoryCount: result.memoryCount, photoCount: result.photoCount,
      mappedItemCount: result.mappedItemCount, uniquePlaceCount: result.uniquePlaceCount,
      earliestContentDate: result.earliestContentDate, latestContentDate: result.latestContentDate,
      firstPopulatedDay: result.firstPopulatedDay, lastPopulatedDay: result.lastPopulatedDay,
    },
    {
      durationDays: 7, populatedDays: 3, memoryCount: 2, photoCount: 2,
      mappedItemCount: 2, uniquePlaceCount: 3,
      earliestContentDate: '2025-03-02', latestContentDate: '2025-03-06',
      firstPopulatedDay: 2, lastPopulatedDay: 6,
    },
  );
});

test('empty journeys keep useful duration values', () => {
  const result = deriveJourneySummary(journey(), [], []);
  assert.equal(result.populatedDays, 0);
  assert.equal(result.earliestContentDate, null);
});

test('timeline stats always reserve four cards and preserve valid zero values', () => {
  const empty = deriveJourneySummary(journey({ place_id: null }), [], []);
  assert.deepEqual(Array.from(journeyTimelineStats(empty), (item) => ({ ...item })), [
    { label: 'Days', value: '7' },
    { label: 'Memories', value: '0' },
    { label: 'Photos', value: '0' },
    { label: 'Places', value: '0' },
  ]);
});
