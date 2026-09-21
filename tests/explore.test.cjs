const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync('src/features/explore/store.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(fetcher) {
  let now = 0, next = 0;
  const timers = new Map(), mod = { exports: {} };
  vm.runInNewContext(output, { module: mod, exports: mod.exports, AbortController, setTimeout: (fn, delay) => { timers.set(++next, { fn, at: now + delay }); return next; }, clearTimeout: id => timers.delete(id) });
  return { store: mod.exports.createExploreStore(fetcher), tick(ms) { now += ms; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); } } };
}
function response(query, ids = [], next = null) { return { query, users: { items: ids.map(id => ({ id })), next_cursor: next }, journeys: { items: [], next_cursor: null }, places: { items: [], next_cursor: null } }; }
const flush = () => new Promise(resolve => setImmediate(resolve));

test('Explore debounces at 350ms and cancels earlier keystrokes', async () => {
  const calls = [];
  const h = harness(async q => { calls.push(q); return response(q); });
  h.store.setQuery('it'); h.tick(300); h.store.setQuery('italy'); h.tick(349);
  assert.equal(calls.length, 0);
  h.tick(1); await flush();
  assert.deepEqual(calls, ['italy']);
  assert.equal(h.store.getSnapshot().results.query, 'italy');
  h.store.setQuery(''); h.tick(500);
  assert.equal(h.store.getSnapshot().results, null);
});

test('late responses cannot overwrite a newer query or restore results after blur', async () => {
  const pending = [];
  const h = harness((q, _, __, signal) => new Promise(resolve => pending.push({ q, signal, resolve })));
  h.store.setQuery('italy'); h.tick(350);
  h.store.setQuery('tokyo'); h.tick(350);
  assert.equal(pending[0].signal.aborted, true);
  pending[0].resolve(response('italy')); await flush();
  assert.equal(h.store.getSnapshot().results, null);
  h.store.suspend(); pending[1].resolve(response('tokyo')); await flush();
  assert.equal(h.store.getSnapshot().results, null);
});

test('pagination deduplicates and preserves other groups', async () => {
  let calls = 0;
  const h = harness(async (_, type, cursor) => { calls++; if (type === 'all') return response('anna', ['a'], 'next'); assert.equal(cursor, 'next'); return response('anna', ['a', 'b']); });
  h.store.setQuery('anna'); await h.store.refresh();
  await Promise.all([h.store.loadMore('users'), h.store.loadMore('users')]);
  assert.equal(calls, 2);
  assert.deepEqual(Array.from(h.store.getSnapshot().results.users.items, x => x.id), ['a', 'b']);
  assert.equal(h.store.getSnapshot().results.journeys.items.length, 0);
});

test('error clears unvalidated public results and retry returns empty state', async () => {
  let fail = true;
  const h = harness(async q => { if (fail) throw Error('offline'); return response(q); });
  h.store.setQuery('nowhere'); await h.store.refresh();
  assert.ok(h.store.getSnapshot().error);
  assert.equal(h.store.getSnapshot().results, null);
  fail = false; await h.store.refresh();
  assert.equal(h.store.getSnapshot().error, null);
  assert.equal(h.store.getSnapshot().results.users.items.length, 0);
});

test('Search navigation, theme, Recent actions and shared social components stay wired', () => {
  const screen = fs.readFileSync('src/features/explore/ExploreScreen.tsx', 'utf8');
  for (const expected of ['useProfileTheme', 'DiscoverJourneyCard', 'FollowButton', '/public-profile/', '/discover/journey/', '/explore/place/', 'recentSearchStorage.clear', 'recent.filter', 'addRecentSearch', 'No results for']) assert.ok(screen.includes(expected), expected);
  assert.doesNotMatch(screen, /followers_count|following_count/);
  const card = fs.readFileSync('src/features/discover/components/DiscoverJourneyCard.tsx', 'utf8');
  assert.match(card, /SaveJourneyButton/);
  const place = fs.readFileSync('src/features/explore/PlaceExploreScreen.tsx', 'utf8');
  assert.match(place, /createDiscoverStore/);
  assert.match(place, /masonry/);
  assert.match(place, /store.clear/);
});

test('library search is preserved and recent terms use existing SecureStore', () => {
  assert.match(fs.readFileSync('src/features/search/LibrarySearchScreen.tsx', 'utf8'), /searchApi.search/);
  assert.match(fs.readFileSync('src/features/search/storage.ts', 'utf8'), /expo-secure-store/);
});
