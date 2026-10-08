const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function load(file, mocks = {}, development = false, logs = []) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { module, exports: module.exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, __DEV__: development, console: { debug: (...args) => logs.push(args), warn: (...args) => logs.push(args) } });
  return module.exports;
}
function hooks() {
  const slots = []; let cursor = 0, effects = [], changed;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const React = {
    memo: fn => fn,
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], next => { const resolved = typeof next === 'function' ? next(slots[i]) : next; if (slots[i] !== resolved) { slots[i] = resolved; changed = true; } }]; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
  };
  return { React, render(fn) { let tree, renders = 0; do { cursor = 0; effects = []; changed = false; tree = fn(); effects.forEach(effect => effect()); assert.ok(++renders < 15); } while (changed); return tree; }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
const source = (uri, namespace) => ({ uri, cacheKey: `${namespace}:${uri.split(/[?#]/, 1)[0]}` });
const flush = () => new Promise(resolve => setImmediate(resolve));
const ref = (id, pixels = 384) => ({ id, width: pixels, height: pixels, scale: 1 });
function fixture(cache, read, initial = {}, development = false) {
  const h = hooks(), loads = [], logs = [];
  const Image = { getCachePathAsync: async () => '/cached-encoded-image', loadAsync: (input, options) => { loads.push({ input, options }); return read(input, options); }, readFromCacheAsync: () => { throw Error('Full-resolution cache read must not run for Journey'); } };
  const { JourneyThumbnailImage } = load('src/features/media/components/JourneyThumbnailImage.tsx', {
    react: h.React, 'react/jsx-runtime': jsx, 'expo-image': { Image }, 'react-native': { StyleSheet: { absoluteFill: {} } },
    '../decodedThumbnailCache': cache, '../imageUrl': { cachedImageSource: source },
  }, development, logs);
  const props = { uri: 'https://media/legacy.jpg?signature=SECRET', namespace: 'journey.album.cover:j', cacheScope: 'owner', pixelSize: 384, ...initial };
  return { ...h, props, loads, logs, draw: () => h.render(() => JourneyThumbnailImage(props)) };
}
function cache() { return load('src/features/media/decodedThumbnailCache.ts'); }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('large legacy originals reproduce the rejected reference; grid-sized loading retains before the first display', async () => {
  const c = cache();
  await c.retainDecodedThumbnail('owner', 'original', 'uri', async () => ({ width: 4032, height: 3024, scale: 1 }));
  assert.equal(c.decodedThumbnail('owner', 'original', 'uri'), undefined);
  const native = ref('bounded'); let displayed = 0;
  const f = fixture(c, async () => native, { onLoad: () => displayed++ });
  assert.equal(f.draw(), null, 'initial cold loading has no decoded reference yet');
  await flush();
  const tree = f.draw(); assert.equal(tree.props.source, native);
  assert.equal(c.decodedThumbnailCacheStats().entries, 1, 'reference is retained before native onDisplay');
  assert.equal(displayed, 0); tree.props.onDisplay(); assert.equal(displayed, 1);
  assert.equal(f.loads[0].options.maxWidth, 384); assert.equal(f.loads[0].options.maxHeight, 384);
  assert.equal(tree.props.transition, 0); assert.equal(tree.props.opacity, undefined);
  f.unmount();
});

test('one derivative plus four legacy covers return immediately across 20 Journey/Moment switches', async () => {
  const c = cache(); const refs = Array.from({ length: 5 }, (_, i) => ref(`j${i}`));
  let queries = 0, displays = 0;
  const inputs = refs.map((_, i) => ({ namespace: `journey.album.cover:j${i}`, uri: `https://media/${i ? `original-${i}.jpg` : 'cover.jpg.thumbnail-v1.jpg'}?signature=SECRET` }));
  const mount = (input, i) => fixture(c, async () => { queries++; return refs[i]; }, { ...input, onLoad: () => displays++ });
  let cells = inputs.map(mount); cells.forEach(cell => cell.draw()); await flush();
  cells.forEach((cell, i) => { const tree = cell.draw(); assert.equal(tree.props.source, refs[i]); tree.props.onDisplay(); cell.unmount(); });
  c.setJourneyThumbnailViewport('owner', inputs);
  for (let cycle = 0; cycle < 20; cycle++) {
    for (let i = 0; i < 20; i++) await c.retainDecodedThumbnail('owner', `moment-${i}`, `moment-uri-${i}`, async () => ({ width: 360, height: 640, scale: 1 }));
    cells = inputs.map(mount);
    cells.forEach((cell, i) => { const firstCommit = cell.draw(); assert.equal(firstCommit.props.source, refs[i], 'no URI source or gray wait on return'); firstCommit.props.onDisplay(); });
    await flush(); cells.forEach(cell => cell.unmount());
  }
  assert.equal(queries, 5); assert.equal(displays, 105);
  for (let i = 0; i < 20; i++) assert.ok(c.decodedThumbnail('owner', `moment-${i}`, `moment-uri-${i}`), 'working Moments cache remains usable');
  assert.ok(c.decodedThumbnailCacheStats().estimatedBytes <= 32 * 1024 * 1024);
});

test('signed URL rotation reuses immutable Journey pixels without another decoder or source reset', async () => {
  const c = cache(), native = ref('same-media');
  const f = fixture(c, async () => native); f.draw(); await flush();
  const initial = f.draw(); initial.props.onDisplay();
  const oldDiskKey = f.loads[0].input.cacheKey;
  f.props.uri = 'https://media/legacy.jpg?signature=ROTATED_SECRET';
  const rotated = f.draw(); assert.equal(rotated.props.source, native);
  await flush(); assert.equal(f.loads.length, 1);
  assert.equal(source(f.props.uri, 'owner:journey.album.cover:j').cacheKey, oldDiskKey);
  f.unmount();
  const returning = fixture(c, async () => { throw Error('must not reload retained bytes'); }, { uri: f.props.uri });
  assert.equal(returning.draw().props.source, native); await flush(); assert.equal(returning.loads.length, 0);
  returning.unmount();
});

test('a genuinely changed cover buffers its own old image, rejects stale completion and recovers from expiry', async () => {
  const c = cache(), original = ref('original'), replacement = deferred(), stale = deferred(); let failures = 0;
  const f = fixture(c, (input) => input.uri.includes('stale') ? stale.promise : input.uri.includes('replacement') ? replacement.promise : Promise.resolve(original), { onSourceError: () => failures++ });
  f.draw(); await flush(); assert.equal(f.draw().props.source, original);
  f.props.uri = 'https://media/stale.jpg'; assert.equal(f.draw().props.source, original); await flush();
  f.props.uri = 'https://media/replacement.jpg'; assert.equal(f.draw().props.source, original); await flush();
  stale.resolve(ref('wrong-old-request')); await flush(); assert.equal(f.draw().props.source, original);
  replacement.reject(Error('expired')); await flush(); assert.equal(f.draw().props.source, original); assert.equal(failures, 1);
  const refreshed = ref('renewed');
  // URL renewal supplies an authorized new URI; a bounded cache miss can now finish.
  f.unmount();
  const next = fixture(c, async () => refreshed, { uri: 'https://media/replacement.jpg?signature=fresh' });
  next.draw(); await flush(); assert.equal(next.draw().props.source, refreshed); next.unmount();
});

test('FlashList recycling and account switches never render another Journey/account image', async () => {
  const c = cache(); const first = ref('journey-a'), second = deferred();
  const f = fixture(c, input => input.uri.includes('other') ? second.promise : Promise.resolve(first));
  f.draw(); await flush(); assert.equal(f.draw().props.source, first);
  f.props.namespace = 'journey.album.cover:other'; f.props.uri = 'https://media/other.jpg';
  assert.equal(f.draw(), null, 'even a recycled component without a React remount rejects old identity');
  await flush(); f.props.cacheScope = 'new-account'; assert.equal(f.draw(), null);
  c.clearDecodedThumbnails(); second.resolve(ref('old-private-result')); await flush();
  assert.equal(f.draw(), null); assert.equal(c.decodedThumbnailCacheStats().entries, 0);
  f.unmount();
});

test('cache eviction does not convert a mounted bitmap back to a URI; evicted history can reload bounded', async () => {
  const c = cache(), image = ref('mounted'); const f = fixture(c, async () => image);
  f.draw(); await flush(); assert.equal(f.draw().props.source, image);
  for (let i = 0; i < 100; i++) await c.retainDecodedThumbnail('owner', `history-${i}`, `uri-${i}`, async () => ref(`history-${i}`, 100));
  assert.equal(c.decodedJourneyThumbnail('owner', `${f.loads[0].input.cacheKey}:grid-native:384`), undefined);
  assert.equal(f.draw().props.source, image); assert.equal(f.loads.length, 1);
  f.unmount(); const returning = fixture(c, async () => image);
  returning.draw(); await flush(); assert.equal(returning.draw().props.source, image);
  assert.equal(returning.loads[0].options.maxWidth, 384); returning.unmount();
});

test('last visible Journey references survive Moment/history pressure without increasing either cache budget', async () => {
  const c = cache(), native = ref('viewport'); const f = fixture(c, async () => native);
  f.draw(); await flush(); f.draw(); c.setJourneyThumbnailViewport('owner', [{ namespace: f.props.namespace, uri: f.props.uri }]); f.unmount();
  for (let i = 0; i < 100; i++) await c.retainDecodedThumbnail('owner', `moment-${i}`, `uri-${i}`, async () => ref(`moment-${i}`, 480));
  const returning = fixture(c, async () => { throw Error('visible Journey was evicted'); });
  assert.equal(returning.draw().props.source, native); await flush(); assert.equal(returning.loads.length, 0);
  const stats = c.decodedThumbnailCacheStats(); assert.equal(stats.maxBytes, 32 * 1024 * 1024); assert.equal(stats.maxEntries, 64);
  assert.ok(stats.entries <= 64 && stats.estimatedBytes <= stats.maxBytes && stats.pinnedJourneyEntries <= 32);
  returning.unmount(); c.clearDecodedThumbnails(); assert.equal(c.decodedThumbnailCacheStats().entries, 0);
});

test('decode queue deduplicates callers, runs at most two native loads, and cancels abandoned queued cells', async () => {
  const c = cache(), a = deferred(), b = deferred(); let calls = 0;
  const first = c.acquireJourneyThumbnail('owner', 'a', 'uri-a', () => { calls++; return a.promise; });
  const duplicate = c.acquireJourneyThumbnail('owner', 'a', 'uri-a', () => { throw Error('duplicate native load'); });
  assert.equal(first.promise, duplicate.promise);
  const next = c.acquireJourneyThumbnail('owner', 'b', 'uri-b', () => { calls++; return b.promise; });
  const abandoned = c.acquireJourneyThumbnail('owner', 'c', 'uri-c', () => { throw Error('abandoned work ran'); });
  abandoned.release(); assert.equal(await abandoned.promise, null); await flush(); assert.equal(calls, 2);
  assert.equal(c.decodedThumbnailCacheStats().activeJourneyLoads, 2);
  first.release(); duplicate.release(); a.resolve(ref('a')); b.resolve(ref('b')); await next.promise; await flush(); next.release();
  assert.equal(c.decodedJourneyThumbnail('owner', 'a'), undefined); assert.ok(c.decodedJourneyThumbnail('owner', 'b'));
  assert.equal(c.decodedThumbnailCacheStats().activeJourneyLoads, 0);
});

test('development logs identify retention/decode/display without signed URL tokens', async () => {
  const c = cache(), f = fixture(c, async () => ref('safe'), {}, true);
  f.draw(); await flush(); f.draw().props.onDisplay(); f.unmount();
  const logs = JSON.stringify(f.logs);
  assert.match(logs, /bounded-load-start/); assert.match(logs, /bounded-ready/); assert.match(logs, /display/);
  assert.ok(!logs.includes('SECRET') && !logs.includes('signature=') && !logs.includes('https://'));
});

test('a newly displayed derivative replaces the protected original rather than pinning stale cover versions', async () => {
  const c = cache(), oldImage = ref('original'), thumbnail = ref('derivative');
  const f = fixture(c, input => Promise.resolve(input.uri.includes('thumbnail-v1') ? thumbnail : oldImage));
  f.draw(); await flush(); f.draw(); c.setJourneyThumbnailViewport('owner', [{ namespace: f.props.namespace, uri: f.props.uri }]);
  f.props.uri = 'https://media/legacy.jpg.thumbnail-v1.jpg?signature=NEW_SECRET';
  assert.equal(f.draw().props.source, oldImage); await flush(); assert.equal(f.draw().props.source, thumbnail);
  assert.equal(c.decodedThumbnailCacheStats().pinnedJourneyEntries, 1); f.unmount();
  for (let i = 0; i < 100; i++) await c.retainDecodedThumbnail('owner', `moment-${i}`, `uri-${i}`, async () => ref(`moment-${i}`, 480));
  const returning = fixture(c, async () => { throw Error('current derivative was evicted'); }, { uri: f.props.uri });
  assert.equal(returning.draw().props.source, thumbnail); await flush(); assert.equal(returning.loads.length, 0); returning.unmount();
});
