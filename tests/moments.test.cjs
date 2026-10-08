const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function load(file) { const module = { exports: {} }; const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; vm.runInNewContext(compiled, { module, exports: module.exports, require, Map, Error }); return module.exports; }
const { createPlaybackGate } = load('src/features/moments/playback.ts');
const { publishMoment } = load('src/features/moments/publishMoment.ts');
function player() { return { playing: false, muted: false, play() { this.playing = true; }, pause() { this.playing = false; } }; }
test('only active player can play; next player preloads silently', () => {
  const gate = createPlaybackGate(); const active = player(); const next = player();
  gate.select('a'); gate.register('a', active); gate.register('b', next); gate.allow(true); gate.mute(false);
  assert.equal(active.playing, true); assert.equal(active.muted, false); assert.equal(next.playing, false); assert.equal(next.muted, true);
  gate.select('b'); assert.equal(active.playing, false); assert.equal(active.muted, true); assert.equal(next.playing, true); assert.equal(next.muted, false);
});
test('navigation and background gate stop both players synchronously', () => {
  const gate = createPlaybackGate(); const a = player(); const b = player(); gate.register('a', a); gate.register('b', b); gate.select('a'); gate.allow(true);
  gate.stop(); assert.equal(a.playing, false); assert.equal(b.playing, false);
  gate.allow(true); assert.equal(a.playing, true);
  gate.pause(true); gate.allow(false); gate.allow(true); assert.equal(a.playing, false);
});
test('rapid swipes never leave two players playing and released players stop', () => {
  const gate = createPlaybackGate(); const a = player(); const b = player(); const release = gate.register('a', a); gate.register('b', b); gate.allow(true);
  for (let i=0; i<100; i++) { gate.select(i%2 ? 'a' : 'b'); assert.equal(Number(a.playing)+Number(b.playing), 1); }
  release(); assert.equal(a.playing, false); gate.refresh(); assert.equal(a.playing, false);
});
test('published muted videos stay silent even when viewer unmutes', () => {
  const gate = createPlaybackGate(); const a = player(); gate.register('a', a); gate.select('a', true); gate.allow(true); gate.mute(false); assert.equal(a.muted, true); assert.equal(a.playing, true);
});
const moment = status => ({ id: 'same', status });
test('publishing reports processing, retains stage, and calls publish after upload', async () => {
  const stages=[]; const calls=[]; const drafts=[];
  const result = await publishMoment({ draft: null, signal: new AbortController().signal, create: async () => { calls.push('create'); return moment('draft'); }, upload: async (id, progress) => { calls.push('upload:'+id); progress(25); progress(100); return moment('ready'); }, publish: async id => { calls.push('publish:'+id); return moment('published'); }, onStage: stage => stages.push(stage), onDraft: item => drafts.push(item.status) });
  assert.deepEqual(calls, ['create', 'upload:same', 'publish:same']); assert.deepEqual(drafts, ['draft','ready','published']); assert.equal(result.status, 'published'); assert.ok(stages.includes('processing'));
});
test('retry after publication failure reuses ready upload instead of creating duplicates', async () => {
  let draft = null; let uploads=0; let creates=0; let publishes=0;
  const options = { signal: new AbortController().signal, create: async () => { creates++; return moment('draft'); }, upload: async () => { uploads++; return moment('ready'); }, publish: async () => { if (++publishes === 1) throw new Error('Connection lost'); return moment('published'); }, onStage: () => {}, onDraft: item => { draft=item; } };
  await assert.rejects(publishMoment({ ...options, draft }), /Connection lost/);
  assert.equal(draft.status, 'ready'); await publishMoment({ ...options, draft }); assert.equal(creates,1); assert.equal(uploads,1); assert.equal(publishes,2);
});
test('failed upload never publishes; retry uses same staged ID', async () => {
  let draft=null; let uploads=0; let publishes=0;
  const options = { signal: new AbortController().signal, create: async () => moment('draft'), upload: async id => { assert.equal(id,'same'); if (++uploads === 1) throw new Error('Upload failed'); return moment('ready'); }, publish: async () => { publishes++; return moment('published'); }, onStage: () => {}, onDraft: item => { draft=item; } };
  await assert.rejects(publishMoment({ ...options, draft }), /Upload failed/); assert.equal(publishes,0); await publishMoment({ ...options, draft }); assert.equal(publishes,1);
});
test('cancelled publication never issues the next mutation', async () => {
  const controller = new AbortController(); let publishes=0;
  await assert.rejects(publishMoment({ draft: null, signal: controller.signal, create: async () => moment('draft'), upload: async () => { controller.abort(); return moment('ready'); }, publish: async () => { publishes++; return moment('published'); }, onStage: () => {}, onDraft: () => {} }), /cancelled/); assert.equal(publishes,0);
});
const { suggestedMomentJourneys } = load('src/features/moments/suggestions.ts');
test('journey suggestions rank normalized country, precise place, and capture date without country-name guesses', () => {
  const place = { provider: 'osm', provider_place_id: 'milan', locality: 'Milan', country_code: 'IT' };
  const trip = (id, country_code, start_date, end_date, journeyPlace=null) => ({ id, country_code, start_date, end_date, place: journeyPlace, created_at: '2026-09-01' });
  const choices=[trip('name-only', null, '2026-09-01','2026-09-30'), trip('older-italy','IT','2025-09-01','2025-09-30'), trip('dated-italy','IT','2026-09-18','2026-09-21'), trip('same-place','IT','2026-01-01','2026-01-03',place), trip('other','JP','2026-09-18','2026-09-21',{...place,country_code:'JP',provider_place_id:'tokyo'})];
  const result=suggestedMomentJourneys(choices,place,'2026-09-20T10:00:00Z');
  assert.deepEqual(Array.from(result,item=>item.id),['same-place','dated-italy','older-italy']);
});
test('location/capture metadata are optional and never select a journey automatically', () => {
  assert.deepEqual(Array.from(suggestedMomentJourneys([],null)),[]);
  const journey={id:'italy',country_code:'IT',place:null,created_at:'2026-01-01',start_date:'2026-01-01',end_date:'2026-01-02'};
  assert.deepEqual(Array.from(suggestedMomentJourneys([journey],{country_code:'IT'},undefined),item=>item.id),['italy']);
});

const { playbackFraction, playbackTime, scrubTime } = load('src/features/moments/timeline.ts');
test('timeline clamps unknown duration, seeks outside the track, and reaches 100 percent', () => {
  assert.equal(playbackFraction(0, 0), 0);
  assert.equal(playbackFraction(3, NaN), 0);
  assert.equal(playbackFraction(-5, 60), 0);
  assert.equal(playbackFraction(60, 60), 1);
  assert.equal(playbackFraction(65, 60), 1);
  assert.equal(scrubTime(-20, 200, 60), 0);
  assert.equal(scrubTime(100, 200, 60), 30);
  assert.equal(scrubTime(220, 200, 60), 60);
  assert.equal(scrubTime(40, 0, 60), 0);
  assert.equal(scrubTime(NaN, 200, 60), 0);
});
test('timeline formats real elapsed time and handles missing metadata safely', () => {
  assert.equal(playbackTime(0), '0:00');
  assert.equal(playbackTime(12.9), '0:12');
  assert.equal(playbackTime(88), '1:28');
  assert.equal(playbackTime(NaN), '0:00');
  assert.equal(playbackTime(-1), '0:00');
});

const { createTemporaryPlayback } = load('src/features/moments/temporaryPlayback.ts');
test('hold speed changes only playback rate and release restores normal speed without seeking', () => {
  const rate = createTemporaryPlayback();
  const video = { playing: true, playbackRate: 1, currentTime: 23, muted: false };
  assert.equal(rate.begin(video), true);
  assert.equal(rate.previousRate, 1);
  assert.equal(video.playbackRate, 2);
  assert.equal(rate.begin(video), false);
  rate.reset(); rate.reset();
  assert.deepEqual(video, { playing: true, playbackRate: 1, currentTime: 23, muted: false });
});
test('paused video never starts double speed and a new active video cannot inherit held speed', () => {
  const rate = createTemporaryPlayback();
  const paused = { playing: false, playbackRate: 1 };
  assert.equal(rate.begin(paused), false);
  assert.equal(paused.playbackRate, 1);
  const first = { playing: true, playbackRate: 1 };
  const next = { playing: true, playbackRate: 1 };
  rate.begin(first); rate.reset();
  assert.equal(first.playbackRate, 1);
  assert.equal(next.playbackRate, 1);
  assert.equal(rate.begin(next), true);
  rate.reset(); assert.equal(next.playbackRate, 1);
});

const { createInteractionLock } = load('src/features/navigation/interactionLock.ts');
const { createScrubPreviewQueue, previewLeft } = load('src/features/moments/scrubPreview.ts');
test('scrub lock rejects navigation synchronously and cancellation/unmount releases only its owner', () => {
  const changes = []; const lock = createInteractionLock(value => changes.push(value));
  let navigations = 0;
  const navigate = () => { if (!lock.isLocked()) navigations++; };
  navigate(); assert.equal(navigations, 1);
  const end = lock.acquire();
  for (const destination of ['Home', 'Map', 'Profile', 'Moments']) navigate(destination);
  assert.equal(navigations, 1);
  const other = lock.acquire(); end(); end();
  assert.equal(lock.isLocked(), true);
  other(); assert.equal(lock.isLocked(), false);
  navigate(); assert.equal(navigations, 2);
  assert.deepEqual(changes, [true, true, true, false]);
});
test('scrub preview stays within navigator-aligned screen margins', () => {
  assert.equal(previewLeft(0, 60, 320, 88), 0);
  assert.equal(previewLeft(30, 60, 320, 88), 116);
  assert.equal(previewLeft(60, 60, 320, 88), 232);
  assert.equal(previewLeft(80, 60, 320, 88), 232);
});
test('native scrub preview coalesces movement and ignores late frames after release', async () => {
  const requests = []; const shown = []; const errors = [];
  const queue = createScrubPreviewQueue(time => new Promise(resolve => requests.push({ time, resolve })), frame => shown.push(frame), error => errors.push(error));
  queue.request(1); queue.request(2); queue.request(3);
  assert.deepEqual(requests.map(item => item.time), [1]);
  requests[0].resolve('frame-one'); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests.map(item => item.time), [1, 3]);
  assert.deepEqual(shown, ['frame-one']);
  queue.cancel(); requests[1].resolve('late-frame'); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(shown, ['frame-one']);
  queue.request(4); requests[2].resolve('new-scrub-frame'); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(shown, ['frame-one', 'new-scrub-frame']);
  assert.deepEqual(errors, []);
});
