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

test('keeps refresh active through slow album requests, without duplicate pulls', async () => {
  const h = harness();
  const running = h.run();
  await h.run();
  assert.equal(h.journeyCalls(), 1);
  assert.deepEqual(h.states, [true]);
  h.journeys.resolve([{ id: 'journey-1' }]);
  h.user.resolve();
  await flush();
  assert.equal(h.albumCalls(), 1);
  h.setNow(1200);
  assert.deepEqual(h.states, [true]);
  assert.equal(h.context.refreshInFlight.current, true);
  h.albums.resolve();
  await running;
  assert.deepEqual(h.states, [true, false]);
  assert.equal(h.timers.length, 0);
});

test('fast refresh stays active for only the remainder of 600ms', async () => {
  const h = harness();
  const running = h.run();
  h.setNow(150);
  h.journeys.resolve([]);
  h.user.resolve();
  h.albums.resolve();
  await flush();
  assert.deepEqual(h.states, [true]);
  assert.equal(h.timers[0].delay, 450);
  await h.run();
  assert.equal(h.journeyCalls(), 1);
  h.timers[0].resolve();
  await running;
  assert.deepEqual(h.states, [true, false]);
});

