const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8');
const ast = ts.createSourceFile('profile.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let refreshCallback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'pullToRefresh') {
    refreshCallback = node.initializer.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
function evaluate(callback, context) {
  const output = ts.transpileModule(`globalThis.callback = ${callback};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(output, context);
  return context.callback;
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
function harness() {
  let now = 0;
  const timers = [];
  const states = [];
  const errors = [];
  const journeys = deferred();
  const user = deferred();
  const albums = deferred();
  let journeyCalls = 0;
  let albumCalls = 0;
  const context = {
    requireRefreshSuccess: value => { if (value?.status && value.status !== 'success') throw Error(value.status); },
    summarizeRefresh: results => results.some(result => result.status === 'rejected') ? 'partial' : 'success',
    momentStore: { refreshOutcome: async () => ({ status: 'success' }) }, collection: 'journeys', journeys: [], mediaRequests: { current: new Map() },
    profileRefreshTiming: () => ({ run: (_, fn) => fn(), mark: () => {}, finish: () => {} }),
    refreshJourneysOutcome: undefined,
    refreshInFlight: { current: false },
    albumRequest: { current: null },
    Date: { now: () => now },
    setTimeout: (resolve, delay) => timers.push({ resolve, delay }),
    setRefreshing: (value) => states.push(value),
    setDetailError: (error) => errors.push(error),
    refresh: () => { journeyCalls += 1; return journeys.promise; },
    refreshUser: () => user.promise,
    refreshSocial: async () => {},
    loadAlbums: () => { albumCalls += 1; return albums.promise; },
  };
  return {
    run: evaluate(refreshCallback, context), context, states, errors, timers, journeys, user, albums,
    setNow: (value) => { now = value; },
    journeyCalls: () => journeyCalls,
    albumCalls: () => albumCalls,
  };
}

test('keeps refresh active through summary and identity requests without duplicate pulls or N+1 media work', async () => {
  const h = harness();
  const running = h.run();
  await h.run();
  assert.equal(h.journeyCalls(), 1);
  assert.deepEqual(h.states, [true]);
  h.journeys.resolve([{ id: 'journey-1' }]);
  await flush();
  assert.equal(h.albumCalls(), 0);
  h.setNow(1200);
  assert.deepEqual(h.states, [true]);
  assert.equal(h.context.refreshInFlight.current, true);
  h.user.resolve();
  await running;
  assert.deepEqual(h.states, [true, false]);
  assert.equal(h.timers.length, 0);
});

test('fast refresh completes with the requests without an artificial wait', async () => {
  const h = harness();
  const running = h.run();
  await h.run(); assert.equal(h.journeyCalls(), 1);
  h.journeys.resolve([]); h.user.resolve(); h.albums.resolve();
  await running;
  assert.deepEqual(h.states, [true, false]); assert.equal(h.timers.length, 0);
  assert.equal(h.context.refreshInFlight.current, false);
});

test('Profile has a single transformed cover and independent indicator with hidden native spinner', () => {
  assert.doesNotMatch(source, /heroStretchStyle|refreshHold|runOnJS|scrollY/);
  assert.match(source, /pullInteraction.heroStyle/);
  assert.ok(source.indexOf('<ProfileCover ') > source.indexOf('return (\n    <SafeAreaView'));
  assert.doesNotMatch(source, /coverEntrance/);
  assert.doesNotMatch(source, /pullInteraction.backgroundStyle/);
  assert.equal((source.match(/<ProfileCover /g) || []).length, 1);
  assert.equal((source.match(/label="Open settings"/g) || []).length, 1);
  assert.match(source, /pullInteraction.indicator/);
  assert.equal((source.match(/onScroll=\{pullInteraction.onScroll\}/g) || []).length, 1);
  assert.match(source, /tintColor=\{resolvePresentationColor\("transparent"/);
  assert.match(source, /pullInteraction\.requestRefresh/);
});

test('Moments refresh skips all Journey media work while retaining concurrent identity, counts and summaries', async () => {
  const h = harness(); h.context.collection = 'moments';
  const running = h.run(); h.journeys.resolve([]); h.user.resolve();
  await running; assert.equal(h.albumCalls(), 0); assert.deepEqual(h.states, [true, false]);
});
test('large Profile summary collections reuse album objects without fetching full journey media', () => {
  let requests = 0;
  const module = { exports: {} };
  const mocks = { '@/utils/sessionResource': { createSessionResource: () => { throw Error('Profile summary rendering must not create media requests'); } }, '@/features/media/api': { mediaApi: { list: () => requests++ } } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/profile/dataCache.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => mocks[name]) });
  const journeys = Array.from({ length: 500 }, (_, i) => ({ id: String(i), cover_media_url: `https://media/${i}` }));
  const first = module.exports.cachedProfileAlbums('owner', journeys);
  const second = module.exports.cachedProfileAlbums('owner', journeys);
  assert.equal(requests, 0); assert.equal(second.length, 500);
  first.forEach((item, i) => { assert.equal(second[i], item); assert.equal(item.media.length, 0); });
});

test('JourneyProvider shares concurrent requests and rejects stale account publication', async () => {
  const providerSource = fs.readFileSync('src/features/journeys/JourneyProvider.tsx', 'utf8');
  const providerAst = ts.createSourceFile('provider.tsx', providerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(providerAst) === 'refresh') callback = node.initializer.arguments[0].getText(providerAst);
    ts.forEachChild(node, find);
  }
  find(providerAst);
  const pending = deferred(); let calls = 0, updates = 0;
  const context = { __DEV__: false, pendingMutations: { current: 0 }, journeyRevision: { current: 0 }, cachedJourneys: { current: [] }, userId: 'owner', accountScope: { current: 'owner' }, refreshRequest: { current: null }, journeyApi: { fetchJourneys: () => { calls++; return pending.promise; } }, setError: () => {}, setJourneys: () => updates++, journeyErrorMessage: () => 'Error' };
  const refresh = evaluate(callback, context);
  const first = refresh(); const second = refresh(); assert.equal(first, second); assert.equal(calls, 1);
  context.accountScope.current = 'different-owner'; pending.resolve([]); await first;
  assert.equal(updates, 0); assert.equal(context.refreshRequest.current, null);
});
