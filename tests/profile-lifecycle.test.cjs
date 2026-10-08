const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: name => { if (!(name in deps)) throw Error(name); return deps[name]; }, AbortController, Date, console, __DEV__: false });
  return exports;
}
const { createSessionResource } = load('src/utils/sessionResource.ts');
const { createMomentGridStore } = load('src/features/moments/gridCache.ts');
const { createFollowStatsStore } = load('src/features/follows/statsCache.ts', { '@/utils/sessionResource': { createSessionResource }, './api': { followsApi: {} } });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
test('cold requests deduplicate; warm navigation makes zero requests', async () => {
  let calls = 0; const work = deferred();
  const store = createSessionResource(() => { calls++; return work.promise; }, 'test');
  const first = store.refresh(); assert.equal(store.refresh(), first);
  work.resolve({ count: 5 }); await first;
  const cached = store.getSnapshot().data;
  for (let i = 0; i < 10; i++) await store.refresh();
  assert.equal(calls, 1); assert.equal(store.getSnapshot().data, cached);
});
test('slow and failed explicit refresh keeps previously loaded data', async () => {
  let next = Promise.resolve({ count: 5 });
  const store = createSessionResource(() => next, 'test'); await store.refresh();
  const cached = store.getSnapshot().data; const work = deferred(); next = work.promise;
  const pending = store.refresh(true);
  assert.equal(store.getSnapshot().data, cached); assert.equal(store.getSnapshot().loading, true);
  work.reject(Error('offline')); await pending;
  assert.equal(store.getSnapshot().data, cached); assert.equal(store.getSnapshot().error, null);
  assert.equal(store.getSnapshot().loading, false);
});
test('late response cannot overwrite a mutation or repopulate a cleared account', async () => {
  const work = deferred(); const store = createSessionResource(() => work.promise, 'test');
  const pending = store.refresh(); store.update(() => ({ count: 6 }));
  work.resolve({ count: 5 }); await pending; assert.equal(store.getSnapshot().data.count, 6);
  const late = deferred(); const other = createSessionResource(() => late.promise, 'test');
  const old = other.refresh(); other.clear(); late.resolve({ secret: true }); await old;
  assert.equal(other.getSnapshot().data, null);
});
test('follow count changes immediately, concurrent rollback touches only its own delta', async () => {
  const background = deferred(); let calls = 0;
  const store = createFollowStatsStore(() => ++calls === 1 ? Promise.resolve({ followers_count: 4, following_count: 10 }) : background.promise);
  await store.refresh(); const first = store.beginFollowingChange(1); const second = store.beginFollowingChange(1);
  assert.equal(store.getSnapshot().data.following_count, 12);
  await store.refresh(true); assert.equal(calls, 1);
  first(false); assert.equal(store.getSnapshot().data.following_count, 11);
  second(true); assert.equal(calls, 2);
  background.resolve({ followers_count: 4, following_count: 11 });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(store.getSnapshot().data.following_count, 11);
});
test('Moments retains pagination across warm visits and failed refresh', async () => {
  let calls = 0; let fail = false;
  const store = createMomentGridStore(cursor => { calls++; return fail ? Promise.reject(Error('offline')) : Promise.resolve({ items: [{ id: cursor ? 'second' : 'first' }], next_cursor: cursor ? null : 'page2' }); });
  await store.refresh(); await store.loadMore(); const cached = store.getSnapshot().items;
  for (let i = 0; i < 10; i++) await store.refresh(); assert.equal(calls, 2);
  assert.equal(store.getSnapshot().items, cached); fail = true; await store.refresh(true);
  assert.equal(store.getSnapshot().items, cached); assert.equal(store.getSnapshot().loaded, true);
  assert.equal(store.getSnapshot().error, null);
});
test('Moment publication preserves its item while completing a cold page', async () => {
  const work = deferred(); const store = createMomentGridStore(() => work.promise);
  const pending = store.refresh(); store.upsert({ id: 'new' });
  work.resolve({ items: [{ id: 'old' }], next_cursor: null }); await pending;
  assert.equal(store.getSnapshot().items.length, 2); assert.ok(store.getSnapshot().items.some(item => item.id === 'new')); assert.equal(store.getSnapshot().loaded, true);
});

const dated = (id, day, caption = id) => ({ id, created_at: `2026-10-${String(day).padStart(2, '0')}T00:00:00Z`, caption });
test('silent head refresh retains later pages, updates IDs, preserves the tail cursor and removes unavailable head items', async () => {
  const pages = [
    { items: [dated('a', 9), dated('b', 8)], next_cursor: 'head' },
    { items: [dated('c', 7), dated('d', 6)], next_cursor: 'tail' },
    { items: [dated('new', 10), dated('a', 9, 'edited')], next_cursor: 'new-head' },
    { items: [dated('b', 8), dated('c', 7)], next_cursor: 'tail' },
    { items: [dated('d', 6), dated('e', 5)], next_cursor: null },
  ];
  const cursors = []; const store = createMomentGridStore(cursor => { cursors.push(cursor); return Promise.resolve(pages.shift()); });
  await store.refresh(); await store.loadMore(); await store.refresh(true);
  assert.equal(store.getSnapshot().items.map(item => item.id).join(','), 'new,a,b,c,d');
  assert.equal(store.getSnapshot().items.find(item => item.id === 'a').caption, 'edited');
  assert.equal(store.getSnapshot().nextCursor, 'tail'); await store.loadMore();
  assert.equal(cursors.join(','), ',head,,new-head,tail');
  assert.equal(store.getSnapshot().items.map(item => item.id).join(','), 'new,a,b,c,d,e');
  assert.equal(store.getSnapshot().nextCursor, null);
});
test('missing head item inside the refreshed range is removed; valid tail remains', async () => {
  let page = { items: [dated('a', 9), dated('b', 8)], next_cursor: 'head' };
  const store = createMomentGridStore(() => Promise.resolve(page)); await store.refresh();
  page = { items: [dated('c', 7)], next_cursor: 'tail' }; await store.loadMore();
  page = { items: [dated('a', 9), dated('c', 7)], next_cursor: null }; await store.refresh(true);
  assert.equal(store.getSnapshot().items.map(item => item.id).join(','), 'a,c');
  assert.equal(store.getSnapshot().nextCursor, null);
});
test('optimistic Moment delete deduplicates stale responses and rollback preserves ordering/cursor', async () => {
  const store = createMomentGridStore(() => Promise.resolve({ items: [dated('a', 9), dated('b', 8), dated('c', 7)], next_cursor: 'next' }));
  await store.refresh(); const rollbackA = store.beginRemove('a'); const rollbackB = store.beginRemove('b');
  assert.equal(store.getSnapshot().items.map(item => item.id).join(','), 'c');
  rollbackB(false); rollbackA(false);
  assert.equal(store.getSnapshot().items.map(item => item.id).join(','), 'a,b,c');
  assert.equal(store.getSnapshot().nextCursor, 'next');
  const commit = store.beginRemove('b'); commit(true); await store.refresh(true);
  assert.equal(store.getSnapshot().items.map(item => item.id).join(','), 'a,c');
});
test('account clear rejects a late optimistic rollback and publish deduplicates canonical IDs', async () => {
  const store = createMomentGridStore(() => Promise.resolve({ items: [dated('a', 9)], next_cursor: 'next' }));
  await store.refresh(); const finish = store.beginRemove('a'); store.clear(); finish(false);
  assert.equal(store.getSnapshot().items.length, 0);
  store.upsert(dated('new', 10)); store.upsert(dated('new', 10, 'canonical'));
  assert.equal(store.getSnapshot().items.length, 1); assert.equal(store.getSnapshot().items[0].caption, 'canonical');
});

test('publishing into a cold Moments cache does not claim the complete first page is loaded', async () => {
  let calls = 0;
  const store = createMomentGridStore(async () => { calls++; return { items: [{ id: 'published' }, { id: 'older' }], next_cursor: 'older-tail' }; });
  store.upsert({ id: 'published' }); assert.equal(store.getSnapshot().loaded, false);
  await store.refresh(); assert.equal(calls, 1); assert.equal(store.getSnapshot().items.map(item => item.id).join(','), 'published,older');
});
test('targeted Moment URL renewal deduplicates and cannot undo deletion or account clear', async () => {
  const store = createMomentGridStore(async () => ({ items: [{ id: 'a', cover_url: 'old' }, { id: 'b' }], next_cursor: 'tail' })); await store.refresh();
  let calls = 0; const renewal = deferred(); const load = () => { calls++; return renewal.promise; };
  const first = store.refreshItem('a', load); assert.equal(store.refreshItem('a', load), first); assert.equal(calls, 1);
  const settle = store.beginRemove('a'); renewal.resolve({ id: 'a', cover_url: 'new' }); await first;
  assert.equal(store.getSnapshot().items.map(item => item.id).join(','), 'b'); settle(false);
  assert.equal(store.getSnapshot().items[0].cover_url, 'old'); assert.equal(store.getSnapshot().nextCursor, 'tail');
  const later = deferred(); const late = store.refreshItem('a', () => later.promise); store.clear(); later.resolve({ id: 'a', cover_url: 'late' }); await late;
  assert.equal(store.getSnapshot().items.length, 0);
});
test('Moment API delete is immediate, deduplicates taps, rolls back failure and scopes publication to the session', async () => {
  const grids = load('src/features/moments/gridCache.ts'); const pending = deferred(); let calls = 0;
  const store = grids.momentGridFor('owner', { owner_id: 'owner' }, async () => ({ items: [{ id: 'a' }, { id: 'b' }], next_cursor: 'tail' })); await store.refresh();
  const { momentsApi } = load('src/features/moments/api.ts', { './gridCache': grids, '@/api/client': { apiRequest: () => { calls++; return pending.promise; }, apiUpload: () => {} } });
  const deletion = momentsApi.delete('a'); assert.equal(momentsApi.delete('a'), deletion); assert.equal(calls, 1); assert.equal(store.getSnapshot().items[0].id, 'b');
  pending.reject(Error('offline')); await assert.rejects(deletion, /offline/); assert.equal(store.getSnapshot().items[0].id, 'a');
  const publication = deferred();
  const scoped = load('src/features/moments/api.ts', { './gridCache': grids, '@/api/client': { apiRequest: () => publication.promise, apiUpload: () => {} } });
  const publishing = scoped.momentsApi.publish('new'); grids.clearMomentGridCache();
  const nextStore = grids.momentGridFor('owner', { owner_id: 'owner' }, async () => ({ items: [], next_cursor: null }));
  publication.resolve({ id: 'new', creator: { id: 'owner' }, place: { id: 'place' } }); await publishing;
  assert.equal(nextStore.getSnapshot().items.length, 0);
});


test('cold publication finishes initial pagination and preserves newer canonical data', async () => {
  const work = deferred(); const store = createMomentGridStore(() => work.promise);
  const request = store.refresh(); store.upsert({ id: 'new', caption: 'canonical' });
  work.resolve({ items: [{ id: 'new', caption: 'stale' }, { id: 'older' }], next_cursor: 'tail' }); await request;
  assert.equal(store.getSnapshot().items.find(item => item.id === 'new').caption, 'canonical');
  assert.equal(store.getSnapshot().items.length, 2); assert.equal(store.getSnapshot().nextCursor, 'tail');
  assert.equal(store.getSnapshot().loaded, true);
});
test('different Moment URL renewals complete independently while a page is pending', async () => {
  const page = deferred(); let first = true;
  const store = createMomentGridStore(() => first ? (first = false, Promise.resolve({ items: [{ id: 'a', cover_url: 'old-a' }, { id: 'b', cover_url: 'old-b' }], next_cursor: 'tail' })) : page.promise);
  await store.refresh(); const more = store.loadMore(); const a = deferred(), b = deferred();
  const ra = store.refreshItem('a', () => a.promise), rb = store.refreshItem('b', () => b.promise);
  a.resolve({ id: 'a', cover_url: 'new-a' }); await ra;
  b.resolve({ id: 'b', cover_url: 'new-b' }); await rb;
  page.resolve({ items: [{ id: 'a', cover_url: 'stale-a' }, { id: 'c' }], next_cursor: null }); await more;
  assert.equal(store.getSnapshot().items.find(item => item.id === 'a').cover_url, 'new-a');
  assert.equal(store.getSnapshot().items.find(item => item.id === 'b').cover_url, 'new-b');
  assert.ok(store.getSnapshot().items.some(item => item.id === 'c'));
});

test('refresh contracts expose network, authorization and stale outcomes without clearing good data', async () => {
  let next = Promise.resolve({ count: 5 });
  const resource = createSessionResource(() => next, 'outcomes');
  assert.equal((await resource.refreshOutcome()).status, 'success');
  next = Promise.reject(Error('offline'));
  assert.equal((await resource.refreshOutcome(true)).status, 'network');
  assert.equal(resource.getSnapshot().data.count, 5);
  next = Promise.reject(Object.assign(Error('private'), { status: 403 }));
  assert.equal((await resource.refreshOutcome(true)).status, 'authorization');
  const late = deferred(); next = late.promise;
  const stale = resource.refreshOutcome(true); resource.clear(); late.resolve({ count: 8 });
  assert.equal((await stale).status, 'cancelled');
  const grid = createMomentGridStore(() => Promise.reject(Error('offline')));
  assert.equal((await grid.refreshOutcome(true)).status, 'network');
});
test('partial refresh differs from total failure', () => {
  const { summarizeRefresh } = load('src/utils/refreshOutcome.ts');
  assert.equal(summarizeRefresh([{ status: 'fulfilled' }, { status: 'rejected', reason: Error('offline') }]), 'partial');
  assert.equal(summarizeRefresh([{ status: 'rejected', reason: { status: 401 } }]), 'authorization');
});
test('URL renewals deduplicate, retry transient failures, and allow recovery after exhaustion', async () => {
  const { createUrlRenewalCoordinator } = load('src/utils/urlRenewal.ts');
  const delays = []; const coordinator = createUrlRenewalCoordinator(async ms => { delays.push(ms); });
  const pending = deferred(); let calls = 0;
  const first = coordinator.run('same', () => { calls++; return pending.promise; });
  assert.equal(coordinator.run('same', () => { calls++; }), first);
  pending.resolve(); await first; assert.equal(calls, 1);
  await assert.rejects(coordinator.run('failed', async () => { calls++; throw Error('offline'); }));
  assert.deepEqual(delays, [500, 1000]);
  await coordinator.run('failed', async () => { calls++; }); assert.equal(calls, 5);
  let authCalls = 0;
  await assert.rejects(coordinator.run('private', async () => { authCalls++; throw { status: 403 }; }));
  assert.equal(authCalls, 1);
  const late = deferred(); const cancelled = coordinator.run('old-account', () => late.promise);
  coordinator.clear(); late.reject(Error('offline')); await assert.rejects(cancelled);
  assert.equal(delays.length, 2);
});

for (const count of [0, 1, 5, 20, 105]) test(`Journey pages preserve ${count} records and total counts`, async () => {
  const { createProfileJourneyStore } = load('src/features/journeys/profileStore.ts');
  const records = Array.from({ length: count }, (_, i) => ({ id: String(i).padStart(4, '0'), created_at: String(9999 - i) }));
  let calls = 0;
  const store = createProfileJourneyStore(async cursor => { calls++; const start = Number(cursor || 0); return { items: records.slice(start, start + 24), next_cursor: start + 24 < count ? String(start + 24) : null, total_count: count }; });
  await store.refresh();
  assert.equal(store.getSnapshot().items.length, Math.min(count, 24)); assert.equal(calls, 1);
  while (store.getSnapshot().nextCursor) await store.loadMore();
  assert.equal(store.getSnapshot().totalCount, count);
  assert.equal(new Set(store.getSnapshot().items.map(item => item.id)).size, count);
  const before = calls; for (let i = 0; i < 20; i++) await store.refresh(); assert.equal(calls, before);
});
test('Journey cold publication, deletion rollback and account cleanup survive stale page work', async () => {
  const { createProfileJourneyStore } = load('src/features/journeys/profileStore.ts');
  let work = deferred(); const store = createProfileJourneyStore(() => work.promise);
  const first = store.refresh(); store.upsert({ id: 'new', created_at: '2026' }, true);
  work.resolve({ items: [{ id: 'old', created_at: '2025' }], next_cursor: 'tail', total_count: 1 }); await first;
  assert.equal(store.getSnapshot().items.length, 2);
  const settle = store.beginRemove('new'); work = deferred(); const refresh = store.refresh(true);
  settle(false); assert.equal(store.getSnapshot().items.some(item => item.id === 'new'), true);
  store.clear(); work.resolve({ items: [{ id: 'secret', created_at: '2024' }], next_cursor: null, total_count: 1 }); await refresh;
  assert.equal(store.getSnapshot().items.length, 0);
});

test('Moment inactive-store LRU preserves subscribed stores and isolates viewers', async () => {
  const { momentGridFor, clearMomentGridCache } = load('src/features/moments/gridCache.ts');
  const fetch = async () => ({ items: [{ id: 'cached' }], next_cursor: null });
  const active = momentGridFor('viewer-a', { owner_id: 'active' }, fetch); await active.refresh();
  const unsubscribe = active.retainActive();
  const oldest = momentGridFor('viewer-a', { owner_id: 'oldest' }, fetch); await oldest.refresh();
  for (let i = 0; i < 30; i++) momentGridFor('viewer-a', { owner_id: String(i) }, fetch);
  assert.equal(active.getSnapshot().items.length, 1); assert.equal(oldest.getSnapshot().items.length, 0);
  assert.notEqual(momentGridFor('viewer-b', { owner_id: 'active' }, fetch), active);
  unsubscribe(); clearMomentGridCache(); assert.equal(active.getSnapshot().items.length, 0);
});
test('Public Profile caches isolate viewers, retain warm identity and reject late account work', async () => {
  const { createDiscoverStore } = load('src/features/discover/store.ts');
  const identity = deferred();
  const { publicProfileFor, clearPublicProfileCache } = load('src/features/publicProfile/cache.ts', {
    '@/utils/sessionResource': { createSessionResource }, '@/features/discover/store': { createDiscoverStore },
    './api': { publicProfileApi: { get: () => identity.promise, journeys: async () => ({ items: [], next_cursor: null }) } },
  });
  const a = publicProfileFor('viewer-a', 'owner'), b = publicProfileFor('viewer-b', 'owner');
  assert.notEqual(a, b); assert.equal(publicProfileFor('viewer-a', 'owner'), a);
  const pending = a.identity.refresh(); clearPublicProfileCache(); identity.resolve({ username: 'secret' }); await pending;
  assert.equal(a.identity.getSnapshot().data, null);
});

test('remote deletion in a loaded terminal Moment page does not survive below the refreshed boundary', async () => {
  let deleted = false;
  const store = createMomentGridStore(async cursor => cursor
    ? { items: deleted ? [dated('c', 7)] : [dated('c', 7), dated('d', 6)], next_cursor: null }
    : { items: [dated('a', 9), dated('b', 8)], next_cursor: 'tail' });
  await store.refresh(); await store.loadMore(); deleted = true; await store.refresh(true);
  assert.equal(store.getSnapshot().items.map(item => item.id).join(','), 'a,b,c');
  assert.equal(store.getSnapshot().nextCursor, null);
});

test('successful signing followed by repeated native failures is bounded across signature changes', async () => {
  const { createUrlRenewalCoordinator, thumbnailRenewalKey } = load('src/utils/urlRenewal.ts');
  const coordinator = createUrlRenewalCoordinator(async () => {}); let calls = 0;
  const key = thumbnailRenewalKey('moment', 'id', 'https://media/cover?v=old');
  assert.equal(key, thumbnailRenewalKey('moment', 'id', 'https://media/cover?v=new'));
  for (let i = 0; i < 3; i++) await coordinator.run(key, async () => { calls++; });
  await assert.rejects(coordinator.run(key, async () => { calls++; }), /recovery limit/);
  assert.equal(calls, 3);
  coordinator.reset(key); await coordinator.run(key, async () => { calls++; }); assert.equal(calls, 4);
  coordinator.clear();
});
