const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const output = ts.transpileModule(fs.readFileSync('src/features/savedJourneys/store.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(output, { module: moduleValue, exports: moduleValue.exports });
const { createSaveStore } = moduleValue.exports;

test('optimistic save is shared by subscribers and rapid duplicates send one request', async () => {
  let resolve;
  let calls = 0;
  const store = createSaveStore(() => { calls++; return new Promise((done) => { resolve = done; }); });
  const changes = [];
  const unsubscribe = store.subscribe(() => changes.push(store.getSnapshot().get('journey').saved));
  const pending = store.toggle('journey', false);
  assert.equal(store.getSnapshot().get('journey').saved, true);
  assert.equal(store.getSnapshot().get('journey').pending, true);
  await store.toggle('journey', false);
  assert.equal(calls, 1);
  resolve();
  await pending;
  assert.equal(store.getSnapshot().get('journey').pending, false);
  assert.deepEqual(changes, [true, true]);
  unsubscribe();
});

test('failed save rolls back with inline error and can be retried', async () => {
  let fail = true;
  const store = createSaveStore(async () => { if (fail) throw new Error('network'); });
  await store.toggle('journey', false);
  assert.equal(store.getSnapshot().get('journey').saved, false);
  assert.ok(store.getSnapshot().get('journey').error);
  fail = false;
  await store.toggle('journey', false);
  assert.equal(store.getSnapshot().get('journey').saved, true);
  assert.equal(store.getSnapshot().get('journey').error, null);
});

test('unsave uses latest shared value even from a stale card and failure restores Saved', async () => {
  const values = [];
  const store = createSaveStore(async (_id, saved) => {
    values.push(saved);
    if (!saved) throw new Error('offline');
  });
  await store.toggle('journey', false);
  await store.toggle('journey', false);
  assert.deepEqual(values, [true, false]);
  assert.equal(store.getSnapshot().get('journey').saved, true);
  assert.ok(store.getSnapshot().get('journey').error);
});

test('logout clears state and ignores late mutation completion', async () => {
  let resolve;
  const store = createSaveStore(() => new Promise((done) => { resolve = done; }));
  const pending = store.toggle('journey', false);
  store.clear();
  resolve();
  await pending;
  assert.equal(store.getSnapshot().size, 0);
});

test('two accounts have independent saved state', async () => {
  const a = createSaveStore(async () => {});
  const b = createSaveStore(async () => {});
  await a.toggle('journey', false);
  assert.equal(a.getSnapshot().get('journey').saved, true);
  assert.equal(b.getSnapshot().has('journey'), false);
});
