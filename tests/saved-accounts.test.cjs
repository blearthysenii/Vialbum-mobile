const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function harness() {
  const values = new Map();
  let failToken = false;
  const secure = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value, options) => {
      assert.equal(options.keychainAccessible, 'device-only');
      if (failToken && key.startsWith('vialbum.saved_session.')) throw new Error('Storage failed');
      values.set(key, value);
    },
    deleteItemAsync: async (key) => values.delete(key),
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/auth/savedAccounts.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: () => secure });
  return { storage: exports.savedAccountStorage, values, failToken: () => { failToken = true; } };
}
const user = (id) => ({ id, email: `${id}@example.com`, username: id, first_name: 'Test', last_name: 'User', profile_photo_url: null, password: 'must-not-save', bio: 'private' });
test('empty store, minimal metadata, no password, and separate secret', async () => {
  const h = harness();
  assert.equal((await h.storage.list()).length, 0);
  await h.storage.save(user('a'), 'secret');
  const profile = (await h.storage.list())[0];
  assert.equal(profile.email, 'a@example.com');
  assert.equal(profile.password, undefined);
  assert.equal(profile.bio, undefined);
  assert.equal(await h.storage.token('a'), 'secret');
  assert.ok(!h.values.get('vialbum.saved_accounts.v1').includes('secret'));
});
test('concurrent saves preserve both accounts and updates deduplicate', async () => {
  const h = harness();
  await Promise.all([h.storage.save(user('a'), 'one'), h.storage.save(user('b'), 'two')]);
  await h.storage.save({ ...user('a'), username: 'updated' }, 'three');
  const accounts = await h.storage.list();
  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].username, 'updated');
  assert.equal(await h.storage.token('a'), 'three');
});
test('expired session retains card; removal deletes card and secret only for target', async () => {
  const h = harness();
  await h.storage.save(user('a'), 'one');
  await h.storage.save(user('b'), 'two');
  await h.storage.forgetSession('a');
  assert.equal(await h.storage.token('a'), null);
  assert.equal((await h.storage.list()).length, 2);
  await h.storage.remove('b');
  assert.equal(await h.storage.token('b'), null);
  assert.equal((await h.storage.list())[0].id, 'a');
});
test('corrupt storage is reported and not overwritten', async () => {
  const h = harness();
  h.values.set('vialbum.saved_accounts.v1', '{broken');
  await assert.rejects(h.storage.list());
  await assert.rejects(h.storage.save(user('a'), 'one'));
  assert.equal(h.values.get('vialbum.saved_accounts.v1'), '{broken');
});
test('failed credential write reports error and leaves password-only profile', async () => {
  const h = harness();
  h.failToken();
  await assert.rejects(h.storage.save(user('a'), 'one'));
  assert.equal(await h.storage.token('a'), null);
  assert.equal((await h.storage.list()).length, 1);
  await h.storage.remove('a');
  assert.equal((await h.storage.list()).length, 0);
});

function quickHarness({ token = 'secret', error, returnedId = 'a' } = {}) {
  const source = fs.readFileSync('src/features/auth/AuthProvider.tsx', 'utf8');
  const ast = ts.createSourceFile('AuthProvider.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'quickSignIn') callback = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const calls = [];
  class ApiError extends Error { constructor(status) { super('error'); this.status = status; } }
  const context = {
    savedAccountStorage: { token: async () => token, forgetSession: async (id) => calls.push(['forget', id]) },
    authApi: { me: async () => { if (error) throw new ApiError(error); return { id: returnedId }; } },
    tokenStorage: { set: async (value) => calls.push(['active', value]) },
    setUser: (user) => calls.push(['user', user.id]), ApiError,
  };
  vm.runInNewContext(ts.transpileModule(`globalThis.run = ${callback}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { run: context.run, calls };
}
test('quick login activates only a server-validated matching account', async () => {
  const h = quickHarness();
  assert.equal(await h.run('a'), true);
  assert.deepEqual(h.calls, [['active', 'secret'], ['user', 'a']]);
});
test('expired or mismatched credentials are removed and request password login', async () => {
  for (const options of [{ error: 401 }, { returnedId: 'b' }]) {
    const h = quickHarness(options);
    assert.equal(await h.run('a'), false);
    assert.deepEqual(h.calls, [['forget', 'a']]);
  }
});
test('network/server failure preserves saved credentials without activating user', async () => {
  const h = quickHarness({ error: 503 });
  await assert.rejects(h.run('a'));
  assert.deepEqual(h.calls, []);
});
test('profile without saved token goes directly to password login', async () => {
  const h = quickHarness({ token: null });
  assert.equal(await h.run('a'), false);
  assert.deepEqual(h.calls, []);
});
