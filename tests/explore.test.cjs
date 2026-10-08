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
function response(query, ids = [], next = null) { return { query, users: { items: ids.map(id => ({ id })), next_cursor: next }, journeys: { items: [], next_cursor: null }, places: { items: [], next_cursor: null }, stays: { items: [], next_cursor: null }, moments: { items: [], next_cursor: null } }; }
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
  for (const expected of ['useProfileTheme', 'DiscoverJourneyCard', 'FollowButton', 'StayResults', 'Search Vialbum', 'Places, journeys, people…', '/public-profile/', '/post/[id]', '/explore/place/', 'recentSearchStorage.clear', 'recent.filter', 'addRecentSearch', 'No results for']) assert.ok(screen.includes(expected), expected);
  assert.match(screen, /scope: 'public'/);
  assert.doesNotMatch(screen, /followers_count|following_count/);
  const card = fs.readFileSync('src/features/discover/components/DiscoverJourneyCard.tsx', 'utf8');
  assert.match(card, /SaveJourneyButton/);
  const place = fs.readFileSync('src/features/explore/PlaceExploreScreen.tsx', 'utf8');
  assert.match(place, /exploreApi.destination/);
  assert.match(place, /MomentPreviews/);
  assert.match(place, /StayResults/);
  assert.match(place, /controller.signal.aborted/);
});

test('library search is preserved and recent terms use existing SecureStore', () => {
  assert.match(fs.readFileSync('src/features/search/LibrarySearchScreen.tsx', 'utf8'), /searchApi.search/);
  assert.match(fs.readFileSync('src/features/search/storage.ts', 'utf8'), /expo-secure-store/);
});

test('Stay result pagination deduplicates while preserving destination results', async () => {
  const h = harness(async (q, type) => {
    const result = response(q);
    result.places.items = [{ id: 'normalized-city' }];
    result.stays = type === 'all' ? { items: [{ id: 'stay-a' }], next_cursor: 'next-stays' } : { items: [{ id: 'stay-a' }, { id: 'stay-b' }], next_cursor: null };
    return result;
  });
  h.store.setQuery('milan'); await h.store.refresh();
  await h.store.loadMore('stays');
  assert.deepEqual(Array.from(h.store.getSnapshot().results.stays.items, x => x.id), ['stay-a', 'stay-b']);
  assert.equal(h.store.getSnapshot().results.places.items[0].id, 'normalized-city');
});

test('content chip selection preserves query, cancels stale responses and filters subsequent keystrokes', async () => {
  const pending = [];
  const h = harness((q, type, cursor, signal) => new Promise(resolve => pending.push({ q, type, cursor, signal, resolve })));
  h.store.setQuery('milan'); h.tick(350);
  h.store.setCategory('stays');
  assert.equal(h.store.getSnapshot().query, 'milan');
  assert.equal(pending[0].signal.aborted, true); assert.equal(pending[1].type, 'stays');
  pending[0].resolve(response('milan')); await flush(); assert.equal(h.store.getSnapshot().results, null);
  const filtered = response('milan'); filtered.stays.items = [{ id: 'real-stay' }];
  pending[1].resolve(filtered); await flush();
  assert.equal(h.store.getSnapshot().results.stays.items[0].id, 'real-stay');
  h.store.setQuery('rome'); h.tick(349); assert.equal(pending.length, 2);
  h.tick(1); assert.equal(pending[2].type, 'stays');
  h.store.setCategory('moments'); assert.equal(pending[2].signal.aborted, true);
  assert.equal(pending[3].q, 'rome'); assert.equal(pending[3].type, 'moments');
});
test('blank-query discovery follows selected content type and category pagination stays scoped', async () => {
  const calls = [];
  const h = harness(async (q, type, cursor) => { calls.push({ q, type, cursor }); const value = response(q); value.moments = { items: [{ id: cursor ? 'next' : 'first' }], next_cursor: cursor ? null : 'more' }; return value; });
  await h.store.refresh(); assert.equal(calls[0].q, ''); assert.equal(calls[0].type, 'all');
  h.store.setCategory('moments'); await flush();
  await h.store.loadMore('users'); assert.equal(calls.length, 2);
  await h.store.loadMore('moments');
  assert.equal(calls[2].type, 'moments'); assert.equal(calls[2].cursor, 'more');
  assert.equal(h.store.getSnapshot().results.moments.items.length, 2);
});


test('discovery revision changes on refresh only; navigation suspension preserves session pages', async () => {
  const h = harness(async q => response(q, ['a'], 'next'));
  await h.store.refresh();
  const first = h.store.getSnapshot().revision;
  await h.store.loadMore('users');
  assert.equal(h.store.getSnapshot().revision, first);
  h.store.suspend(true);
  assert.equal(h.store.getSnapshot().results.users.items[0].id, 'a');
  await h.store.refresh();
  assert.equal(h.store.getSnapshot().revision, first + 1);
});


test('blur blocks automatic pagination until the retained discovery session resumes', async () => {
  let requests = 0;
  const h = harness(async q => { requests++; return response(q, ['a'], 'next'); });
  await h.store.refresh();
  h.store.suspend(true);
  await h.store.loadMore('users');
  assert.equal(requests, 1);
  await h.store.resume();
  assert.equal(requests, 1);
  await h.store.loadMore('users');
  assert.equal(requests, 2);
});
