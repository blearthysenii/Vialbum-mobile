const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const output = ts.transpileModule(fs.readFileSync('src/features/follows/store.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(output, { module: moduleValue, exports: moduleValue.exports });
const { createFollowStore } = moduleValue.exports;

test('follow is optimistic and duplicate taps send only one request', async () => {
  let resolve, requests = 0, refreshes = 0;
  const store = createFollowStore(() => { requests++; return new Promise(done => { resolve = done; }); }, () => refreshes++);
  const states = [];
  store.subscribe(() => states.push(store.getSnapshot().get('alice').following));
  const pending = store.toggle('alice', false);
  assert.equal(store.getSnapshot().get('alice').following, true);
  assert.equal(store.getSnapshot().get('alice').pending, true);
  await store.toggle('alice', false);
  assert.equal(requests, 1);
  resolve(); await pending;
  assert.equal(store.getSnapshot().get('alice').pending, false);
  assert.equal(refreshes, 1);
  assert.deepEqual(states, [true, true]);
});

test('failed follow and unfollow roll back and allow retry', async () => {
  for (const before of [true, false]) {
    let fail = true, refreshes = 0;
    const store = createFollowStore(async () => { if (fail) throw Error('offline'); }, () => refreshes++);
    await store.toggle('alice', before);
    assert.equal(store.getSnapshot().get('alice').following, before);
    assert.ok(store.getSnapshot().get('alice').error);
    assert.equal(refreshes, 0);
    fail = false;
    await store.toggle('alice', before);
    assert.equal(store.getSnapshot().get('alice').following, !before);
    assert.equal(store.getSnapshot().get('alice').error, null);
  }
});

test('stale profile initial value cannot override a list mutation', async () => {
  const changes = [];
  const store = createFollowStore(async (_, value) => changes.push(value), () => {});
  await store.toggle('alice', false);
  await store.toggle('alice', false);
  assert.deepEqual(changes, [true, false]);
});

test('logout discards pending completion and account stores are isolated', async () => {
  let resolve, refreshes = 0;
  const a = createFollowStore(() => new Promise(done => { resolve = done; }), () => refreshes++);
  const b = createFollowStore(async () => {}, () => {});
  const pending = a.toggle('alice', false);
  assert.equal(b.getSnapshot().size, 0);
  a.clear(); resolve(); await pending;
  assert.equal(a.getSnapshot().size, 0);
  assert.equal(refreshes, 0);
});

// Structural route/UI contracts supplement store tests; device interaction is QA'd separately.
test('Home switches feeds and provides both Following empty states', () => {
  const source = fs.readFileSync('src/features/discover/components/DiscoverFeed.tsx', 'utf8');
  assert.match(source, /useDiscoverFeed\(mode\)/);
  assert.match(source, /setMode\(tab\)/);
  assert.match(source, /Follow travelers to see their journeys here/);
  assert.match(source, /No new journeys from people you follow/);
});

test('profile connections routes and self redirect stay wired', () => {
  const header = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8');
  assert.match(header, /\/public-profile\/\[id\]\/connections/);
  assert.match(header, /kind: 'followers'/);
  assert.match(header, /kind: 'following'/);
  const route = fs.readFileSync('app/public-profile/[id].tsx', 'utf8');
  assert.match(route, /Redirect/);
  assert.match(route, /\(tabs\)\/profile/);
  assert.match(fs.readFileSync('src/features/follows/ConnectionsScreen.tsx', 'utf8'), /router.push\(`\/public-profile\/\$\{item.id\}`\)/);
});

test('visitor uses the personal cover and album components, without owner controls', () => {
  const header = fs.readFileSync('src/features/publicProfile/PublicProfileHeader.tsx', 'utf8');
  assert.match(header, /<ProfileCover/);
  assert.match(header, /<FollowButton/);
  assert.doesNotMatch(header, /followers_count|following_count|connections|label: 'Followers'/);
  assert.doesNotMatch(header, /edit-profile|\/settings/);
  assert.match(fs.readFileSync('src/features/publicProfile/PublicJourneyCollection.tsx', 'utf8'), /<JourneyAlbumCard/);
});

test('private lists use current-user endpoints and block foreign route IDs', () => {
  const api = fs.readFileSync('src/features/follows/api.ts', 'utf8');
  assert.match(api, /\/users\/me\/follow-stats/);
  assert.match(api, /\/users\/me\/\$\{kind\}/);
  const route = fs.readFileSync('app/public-profile/[id]/connections.tsx', 'utf8');
  assert.match(route, /id !== user.id/);
  assert.match(route, /Redirect/);
  const profile = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8');
  assert.match(profile, /social.stats\?\.followers_count/);
  assert.match(profile, /social.stats\?\.following_count/);
});
