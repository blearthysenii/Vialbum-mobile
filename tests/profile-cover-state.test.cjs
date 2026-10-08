const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function declaration(path, name) {
  const ast = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { ast, found };
}
function evaluate(source, context) {
  vm.runInNewContext(ts.transpileModule(`globalThis.result = ${source}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.result;
}
test('Profile selector ignores all Journey and album media for every cover state', () => {
  const { ast, found } = declaration('app/(tabs)/profile.tsx', 'profileCoverSource');
  for (const count of [0, 1, 3]) for (const cover of [null, 'https://test/profile']) {
    const journeys = Array.from({ length: count }, () => ({ cover_media_url: 'https://test/journey' }));
    const result = evaluate(found.getText(ast), { user: { profile_cover_url: cover }, journeys, albums: [{ media: [{ type: 'photo', url: 'https://test/photo' }] }] });
    assert.equal(result, cover);
  }
});
test('successful deletion clears state immediately and rejects a stale profile refresh', async () => {
  let resolveRefresh;
  let user = { id: 'me', profile_cover_url: 'https://test/old' };
  const context = { __DEV__: false, profileRevision: { current: 0 }, userRequest: { current: null }, sessionVersion: { current: 0 }, setUser: value => { user = typeof value === 'function' ? value(user) : value; }, authApi: {
    me: () => new Promise(resolve => { resolveRefresh = resolve; }), removeProfileCover: async () => {},
  } };
  const callback = name => {
    const { ast, found } = declaration('src/features/auth/AuthProvider.tsx', name);
    return evaluate(found.arguments[0].getText(ast), context);
  };
  const refresh = callback('refreshUser')();
  await callback('removeProfileCover')();
  assert.equal(user.profile_cover_url, null);
  resolveRefresh({ id: 'me', profile_cover_url: 'https://test/stale' });
  await refresh;
  assert.equal(user.profile_cover_url, null);
});
test('failed deletion retains the explicit cover', async () => {
  const user = { profile_cover_url: 'https://test/old' };
  const { ast, found } = declaration('src/features/auth/AuthProvider.tsx', 'removeProfileCover');
  const callback = evaluate(found.arguments[0].getText(ast), { __DEV__: false, profileRevision: { current: 0 }, userRequest: { current: null }, sessionVersion: { current: 0 }, setUser: () => assert.fail('must not clear failed removal'), authApi: { removeProfileCover: async () => { throw new Error('offline'); } } });
  await assert.rejects(callback(), /offline/);
  assert.equal(user.profile_cover_url, 'https://test/old');
});
