const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function load(file) { const module = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, require, Number, Math }); return module.exports; }
const { initialVideoEdit, moveTrim, videoEditError } = load('src/features/media/videoEdit.ts');
const { deriveStops, reorderStop } = load('src/features/journeys/stops.ts');
const { journeyTransition, travelDistance } = load('src/features/moments/journeyTravel.ts');
test('47 seconds selects whole source; long videos select at most 60 seconds', () => { assert.equal(initialVideoEdit(47).trimEnd, 47); assert.equal(initialVideoEdit(147).trimEnd, 60); });
test('handles enforce valid 60 second range, clamp cover and never modify the original edit', () => {
 const original = { trimStart: 8, trimEnd: 24, coverTime: 9 }; const next = moveTrim(original, 'start', 16, 47);
 assert.equal(next.trimStart, 16); assert.equal(next.coverTime, 16); assert.equal(original.trimStart, 8);
 assert.equal(moveTrim(next, 'end', 140, 147).trimEnd, 76);
 assert.equal(moveTrim(next, 'start', 30, 47).trimStart, 23.8);
 assert.equal(videoEditError({ trimStart: 0, trimEnd: 61, coverTime: 0 }), 'Select a video segment of up to 60 seconds and a cover inside it.');
 assert.ok(videoEditError({ trimStart: 0, trimEnd: 20, coverTime: NaN }));
 assert.equal(videoEditError({ trimStart: 16, trimEnd: 24, coverTime: 20 }, 47), null);
});
test('stops normalize by provider identity and retain media associations on reorder', () => {
 let n=0; const place = { provider: 'test', provider_place_id: '1', name: 'Duomo' };
 const stops = deriveStops([{ key: 'a', place }, { key: 'b', place }, { key: 'c', place: { ...place, provider_place_id: '2', name: 'Como' } }, { key: 'd', place: null }], () => String(++n));
 assert.equal(stops.length, 2); assert.equal(stops[0].mediaKeys.join(','), 'a,b');
 assert.equal(reorderStop(stops, 1, -1)[0].label, 'Como'); assert.equal(stops[0].label, 'Duomo');
});
test('travel transition only occurs across meaningful different stops of the same journey', () => {
 const stops = [{ id: 'a', label: 'Milan', latitude: 45.46, longitude: 9.19 }, { id: 'b', label: 'Como', latitude: 45.81, longitude: 9.08 }];
 const a = { journey_id: 'j', journey_context: { current_stop_id: 'a', stops } }; const b = { journey_id: 'j', journey_context: { current_stop_id: 'b', stops } };
 assert.equal(journeyTransition(a, a), null); assert.equal(journeyTransition(a, { ...b, journey_id: 'other' }), null);
 assert.ok(journeyTransition(a, b).distance > 30); assert.equal(travelDistance(stops[0], { latitude: NaN, longitude: 0 }), null);
});
