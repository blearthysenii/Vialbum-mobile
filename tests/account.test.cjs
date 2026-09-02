const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('src/features/account/config.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(output, {
  module: moduleValue, exports: moduleValue.exports, require,
  process: { env: {} }, URL,
});
const { accountDeletionError, canDeleteAccount, validPublicUrl } = moduleValue.exports;

test('account deletion requires exact deliberate confirmation and a password', () => {
  assert.equal(canDeleteAccount('DELETE', 'password', false), true);
  assert.equal(canDeleteAccount('delete', 'password', false), false);
  assert.equal(canDeleteAccount('DELETE', '', false), false);
  assert.equal(canDeleteAccount('DELETE', 'password', true), false);
});

test('account deletion failures never imply that deletion succeeded', () => {
  assert.match(accountDeletionError({ status: 0 }), /connection/);
  assert.match(accountDeletionError({ status: 401 }), /password/);
  assert.match(accountDeletionError({ status: 503 }), /remains active/);
  assert.match(accountDeletionError(new Error('raw internal error')), /remains active/);
});

test('only configured HTTPS policy links are accepted', () => {
  assert.equal(validPublicUrl('https://vialbum.example/privacy'), true);
  assert.equal(validPublicUrl('http://vialbum.example/privacy'), false);
  assert.equal(validPublicUrl('not a url'), false);
  assert.equal(validPublicUrl(null), false);
});
