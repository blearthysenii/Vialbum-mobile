const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function load(path, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, AbortController, Error,
    require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], `Unexpected import ${name}`); return mocks[name]; }) });
  return module.exports;
}
class ApiError extends Error { constructor(status) { super('Request failed'); this.status = status; } }
const settle = () => new Promise(resolve => setImmediate(resolve));
const post = { id: 'one', title: 'Original', photos: [{ id: 'a' }, { id: 'b' }] };

function mount() {
  const edits = load('src/features/posts/editReturn.ts');
  const slots = [], requests = [];
  let cursor = 0, focus, cleanup;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback: fn => fn,
  };
  const { usePostDetail } = load('src/features/posts/usePostDetail.ts', {
    react: hooks, 'expo-router': { useFocusEffect: fn => { focus = fn; } },
    '@/api/client': { ApiError }, './editReturn': edits,
    './data': { loadPost: (id, own, user, signal) => new Promise((resolve, reject) => requests.push({ id, own, user, signal, resolve, reject })) },
  });
  function RenderPost(id = 'one', user = { id: 'owner' }) {
    cursor = 0;
    return usePostDetail(id, true, user);
  }
  return {
    edits, requests,
    render: RenderPost,
    focus() { cleanup = focus(); }, blur() { cleanup?.(); cleanup = undefined; },
  };
}

test('first load uses skeleton state; unchanged editor Cancel keeps data and skips return request', async () => {
  const app = mount();
  assert.equal(app.render().initialLoading, true);
  app.focus(); app.requests[0].resolve(post); await settle();
  assert.equal(app.render().journey, post);
  app.blur(); app.edits.beginPostEdit('one');
  assert.equal(app.render().journey, post);
  app.focus();
  assert.equal(app.requests.length, 1);
  assert.equal(app.render().initialLoading, false);
  assert.equal(app.render().refreshing, false);
});

test('saved edits silently revalidate existing data and display the updated post', async () => {
  const app = mount(); app.render(); app.focus(); app.requests[0].resolve(post); await settle();
  app.blur(); app.edits.beginPostEdit('one'); app.edits.markPostEditChanged('one');
  app.render(); app.focus();
  assert.equal(app.render().journey, post);
  assert.equal(app.render().initialLoading, false);
  assert.equal(app.render().refreshing, true);
  const updated = { ...post, title: 'Edited' };
  app.requests[1].resolve(updated); await settle();
  assert.equal(app.render().journey, updated);
  assert.equal(app.render().refreshing, false);
});

test('transient refresh failure retains content; explicit retry still fetches', async () => {
  const app = mount(); app.render(); app.focus(); app.requests[0].resolve(post); await settle();
  app.blur(); app.render().refresh(); app.render(); app.focus();
  app.requests[1].reject(new Error('Offline')); await settle();
  assert.equal(app.render().journey, post);
  assert.equal(app.render().error, 'Offline');
  assert.equal(app.render().initialLoading, false);
  app.blur(); app.render().refresh(); app.render(); app.focus();
  assert.equal(app.requests.length, 3);
});

test('aborted and old-route requests cannot replace content for another post', async () => {
  const app = mount(); app.render(); app.focus();
  app.blur(); assert.equal(app.requests[0].signal.aborted, true);
  assert.equal(app.render('two').journey, null);
  app.focus(); app.requests[0].resolve(post); await settle();
  assert.equal(app.render('two').journey, null);
  app.requests[1].resolve({ ...post, id: 'two' }); await settle();
  assert.equal(app.render('two').journey.id, 'two');
  assert.equal(app.render('two', { id: 'different-account' }).journey, null);
});

for (const status of [401, 403, 404]) {
  test(`authoritative ${status} removes unavailable cached content`, async () => {
    const app = mount(); app.render(); app.focus(); app.requests[0].resolve(post); await settle();
    app.blur(); app.render(); app.focus(); app.requests[1].reject(new ApiError(status)); await settle();
    assert.equal(app.render().journey, null);
    assert.equal(app.render().initialLoading, false);
    assert.match(app.render().error, /no longer available/);
  });
}

test('fresh screen has no cached data and editor mutation results are consumed once', () => {
  const app = mount();
  app.edits.beginPostEdit('one'); app.edits.markPostEditChanged('one');
  assert.equal(app.edits.consumePostEdit('one'), true);
  assert.equal(app.edits.consumePostEdit('one'), undefined);
  assert.equal(mount().render().initialLoading, true);
});

test('refresh does not remount PostContent or replace it with refresh error UI', () => {
  const screen = fs.readFileSync('src/features/posts/PostDetailScreen.tsx', 'utf8');
  assert.match(screen, /journey \? <PostContent key=\{`\$\{journey.id\}:\$\{memoryId \?\? ''\}`\}/);
  assert.doesNotMatch(screen, /revision|setJourney\(null\)/);
});
