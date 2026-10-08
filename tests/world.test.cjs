const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function evaluate(path, require, globals = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require, AbortController, ...globals });
  return module.exports;
}
const mapUtils = evaluate('src/features/map/utils.ts', require);
const viewport = evaluate('src/features/world/viewport.ts', () => mapUtils);
const photos = evaluate('src/features/world/photos.ts', () => viewport, { setTimeout, clearTimeout, Date });

test('photo level has hysteresis and city tap enters photo level', () => {
  const region = photos.placeRegion({ latitude: 24.47, longitude: 39.61 });
  assert.equal(photos.photoLevel(region, false), true);
  assert.equal(photos.photoLevel(viewport.WORLD_REGION, true), false);
  const edge = { ...region, longitudeDelta: 360 / 2 ** 9.7 };
  assert.equal(photos.photoLevel(edge, false), false);
  assert.equal(photos.photoLevel(edge, true), true);
  const fit = viewport.fitBounds({ north: 52.52, south: 21.42, west: 13.4, east: 39.82 });
  assert.ok(fit.latitude + fit.latitudeDelta / 2 >= 52.52);
  assert.ok(fit.latitude - fit.latitudeDelta / 2 <= 21.42);
});

test('overlapping photos cluster without changing coordinates; viewer retains journey and media', () => {
  const a = { id: 'a', journey_id: 'journey', latitude: 24.47, longitude: 39.61, display_name: 'Medina Photo 1' };
  const b = { ...a, id: 'b' };
  assert.equal(photos.groupPhotos([a, b], photos.placeRegion(a)).length, 1);
  assert.equal(a.latitude, 24.47);
  assert.equal(photos.photoTarget(b), '/journey/journey/photo/b');
});

test('private photos debounce, cancel stale responses and clear cache', async () => {
  const requests = [];
  const store = photos.createPhotoStore((region, signal) => new Promise(resolve => requests.push({ signal, resolve })));
  const region = photos.placeRegion({ latitude: 24, longitude: 39 });
  store.load(region); store.load(region);
  await new Promise(resolve => setTimeout(resolve, 380));
  assert.equal(requests.length, 1);
  store.load({ ...region, latitude: 25 });
  assert.equal(requests[0].signal.aborted, true);
  requests[0].resolve({ items: [{ id: 'stale' }], truncated: false });
  await new Promise(resolve => setTimeout(resolve, 380));
  assert.equal(store.getSnapshot().items.length, 0);
  requests[1].resolve({ items: [{ id: 'private' }], truncated: false }); await flush();
  assert.equal(store.getSnapshot().items[0].id, 'private');
  store.clear(); assert.equal(store.getSnapshot().items.length, 0);
});
function harness(fetcher) {
  let now = 0, id = 0;
  const timers = new Map();
  const { createWorldStore } = evaluate('src/features/world/store.ts', () => viewport, {
    Date: { now: () => now }, setTimeout: (fn, delay) => { timers.set(++id, { fn, at: now + delay }); return id; }, clearTimeout: key => timers.delete(key),
  });
  return { store: createWorldStore(fetcher), tick(ms) { now += ms; for (const [key, value] of timers) if (value.at <= now) { timers.delete(key); value.fn(); } } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const data = id => ({ items: [{ id }], truncated: false, next_cursor: null });

test('world viewport wraps the dateline and validates world zoom range', () => {
  const box = viewport.viewportFor({ latitude: 85, longitude: 179, latitudeDelta: 30, longitudeDelta: 10 });
  assert.equal(box.north, 90);
  assert.ok(box.west > box.east);
  const world = viewport.viewportFor({ latitude: 0, longitude: 0, latitudeDelta: 180, longitudeDelta: 360 });
  assert.equal(world.west, -180); assert.equal(world.east, 180); assert.equal(world.zoom, 0);
});

test('viewport loading debounces and ignores tiny map movements', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; return data('place'); });
  h.store.setRegion({ ...viewport.WORLD_REGION, latitude: 20.01 });
  h.tick(1000); assert.equal(calls, 0);
  h.store.setRegion({ latitude: 40, longitude: 10, latitudeDelta: 5, longitudeDelta: 5 });
  h.tick(300); assert.equal(calls, 0);
  h.store.setRegion({ latitude: 42, longitude: 10, latitudeDelta: 5, longitudeDelta: 5 });
  h.tick(349); assert.equal(calls, 0);
  h.tick(1); await flush(); assert.equal(calls, 1);
});

test('duplicate refresh is deduplicated and obsolete requests are aborted', async () => {
  const requests = [];
  const h = harness((mode, region, signal) => new Promise(resolve => requests.push({ mode, region, signal, resolve })));
  const first = h.store.refresh(); void h.store.refresh();
  assert.equal(requests.length, 1);
  h.store.setMode('own'); assert.equal(requests[0].signal.aborted, true);
  requests[0].resolve(data('public')); await first;
  assert.equal(h.store.getSnapshot().data, null);
  requests[1].resolve({ ...data('private'), stats: { journeys: 3 } }); await flush();
  assert.equal(h.store.getSnapshot().data.items[0].id, 'private');
  h.store.setMode('explore');
  assert.equal(h.store.getSnapshot().data, null);
  h.store.clear(); requests[2].resolve(data('late')); await flush();
  assert.equal(h.store.getSnapshot().data, null);
});

test('same-account offline data remains visible and retry works', async () => {
  let fail = false;
  const h = harness(async () => { if (fail) throw Error('offline'); return data('safe'); });
  await h.store.refresh(); fail = true; await h.store.refresh();
  assert.equal(h.store.getSnapshot().data.items[0].id, 'safe'); assert.ok(h.store.getSnapshot().error);
  fail = false; await h.store.refresh(); assert.equal(h.store.getSnapshot().error, null);
});

test('cache is bounded by session and cleared with pending private responses', async () => {
  const a = harness(async () => data('A'));
  const b = harness(async () => data('B'));
  a.store.setMode('own'); await flush();
  assert.equal(a.store.getSnapshot().mode, 'own');
  assert.equal(b.store.getSnapshot().data, null);
  a.store.clear(); assert.equal(a.store.getSnapshot().data, null); assert.equal(a.store.getSnapshot().mode, 'explore');
  const cleanup = fs.readFileSync('src/features/auth/cleanup.ts', 'utf8');
  assert.match(cleanup, /clearWorldCaches\(\)/);
  assert.match(fs.readFileSync('app/(tabs)/map.tsx', 'utf8'), /key=\{user.id\}/);
});

test('cluster tap zooms until close range then exposes contained places', () => {
  const marker = { latitude: 45, longitude: 9, bounds: { north: 45, south: 45, east: 9, west: 9 } };
  const zoomed = viewport.expandCluster(marker, { latitude: 45, longitude: 9, latitudeDelta: 1, longitudeDelta: 1 });
  assert.equal(zoomed.latitudeDelta, 0.5);
  assert.equal(viewport.expandCluster(marker, { latitudeDelta: 0.004, longitudeDelta: 0.004 }), null);
  const fit = viewport.fitBounds(marker.bounds); assert.equal(fit.latitudeDelta, 0.08);
});

test('map UI keeps Explore/Your World, sheets and private navigation separate', () => {
  const screen = fs.readFileSync('src/features/world/WorldMapScreen.tsx', 'utf8');
  for (const text of ['Explore', 'Your World', 'state.data.stats.countries', 'Create Journey', 'useProfileTheme', 'onRegionChangeComplete', 'WorldPlaceSheet', 'PersonalMomentsMap']) assert.ok(screen.includes(text), text);
  assert.match(screen, /showsUserLocation=\{false\}/);
  const sheet = fs.readFileSync('src/features/world/WorldPlaceSheet.tsx', 'utf8');
  for (const text of ['worldApi.members', 'worldApi.place', 'exploreApi.place', '/post/[id]', '/explore/place/', 'PanResponder', 'controller.signal.aborted']) assert.ok(sheet.includes(text), text);
  assert.match(sheet, /scope: 'own'/);
  assert.match(fs.readFileSync('src/features/explore/PlaceExploreScreen.tsx', 'utf8'), /worldMapTarget\('explore'/);
  assert.equal(viewport.worldMapTarget('own', 45, 9).params.worldMode, 'own');
});
