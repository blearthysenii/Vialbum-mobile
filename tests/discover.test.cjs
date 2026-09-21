const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function load(path) {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require, AbortController });
  return module.exports;
}
const { createDiscoverStore } = load('src/features/discover/store.ts');
const { publicTimeline, publicMapPoints } = load('src/features/discover/timeline.ts');
const card = (id, owner = 'other', visibility = 'public') => ({ id, creator: { id: owner }, visibility });
const page = (items, next_cursor = null) => ({ items, next_cursor });
const ids = (store) => Array.from(store.getSnapshot().items, (item) => item.id);

test('discovery filters private and own journeys and deduplicates pages', async () => {
  const cursors = [];
  const store = createDiscoverStore('me', async (cursor) => {
    cursors.push(cursor);
    return cursor ? page([card('a'), card('b')])
      : page([card('own', 'me'), card('private', 'other', 'private'), card('a')], 'next');
  });
  await store.refresh();
  assert.deepEqual(ids(store), ['a']);
  await store.loadMore();
  await store.loadMore();
  assert.deepEqual(ids(store), ['a', 'b']);
  assert.deepEqual(cursors, [null, 'next']);
});

test('failed revalidation hides cached public content and retry restores authorized results', async () => {
  let attempt = 0;
  const store = createDiscoverStore('me', async () => {
    attempt++;
    if (attempt === 2) throw new Error('Offline');
    return page([card(attempt === 1 ? 'old' : 'new')]);
  });
  await store.refresh();
  await store.refresh();
  assert.deepEqual(ids(store), []);
  assert.ok(store.getSnapshot().error);
  assert.equal(store.getSnapshot().loading, false);
  await store.refresh();
  assert.deepEqual(ids(store), ['new']);
  assert.equal(store.getSnapshot().error, null);
});

test('refresh cancels pagination and ignores its late response', async () => {
  let resolveMore;
  let moreSignal;
  let calls = 0;
  const store = createDiscoverStore('me', async (cursor, signal) => {
    if (cursor) { moreSignal = signal; return new Promise((resolve) => { resolveMore = resolve; }); }
    return ++calls === 1 ? page([card('old')], 'next') : page([card('fresh')]);
  });
  await store.refresh();
  const more = store.loadMore();
  await store.refresh();
  assert.equal(moreSignal.aborted, true);
  resolveMore(page([card('stale')]));
  await more;
  assert.deepEqual(ids(store), ['fresh']);
});

test('logout clears cached data and prevents late requests restoring it', async () => {
  let resolve;
  const store = createDiscoverStore('me', () => new Promise((done) => { resolve = done; }));
  const pending = store.refresh();
  store.clear();
  resolve(page([card('late')]));
  await pending;
  assert.deepEqual(ids(store), []);
  assert.equal(store.getSnapshot().loaded, false);
});

test('public timeline retains unassigned photos and map filters invalid coordinates', () => {
  const journey = {
    id: 'journey', latitude: '0', longitude: '0',
    memories: [{ id: 'm', memory_date: '2026-01-02', latitude: '91', longitude: '0' }],
    photos: [
      { id: 'attached', memory_id: 'm', created_at: '2026-01-03', latitude: null, longitude: null },
      { id: 'loose', memory_id: 'missing', created_at: '2026-01-01', latitude: '10', longitude: '20' },
    ],
  };
  const timeline = publicTimeline(journey);
  assert.deepEqual(Array.from(timeline, (item) => item.id), ['photo:loose', 'memory:m']);
  assert.equal(timeline[1].photos[0].id, 'attached');
  assert.deepEqual(Array.from(publicMapPoints(journey), (item) => item.id), ['journey', 'loose']);
});
