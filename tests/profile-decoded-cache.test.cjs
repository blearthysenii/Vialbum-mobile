const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function cache() {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/media/decodedThumbnailCache.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports });
  return module.exports;
}
const image = () => ({ width: 128, height: 128, scale: 3 });
test('native thumbnail survives 20 collection removals without another read or URL load', async () => {
  const c = cache(), ref = image(); let reads = 0;
  await c.retainDecodedThumbnail('a', 'asset', 'signed-old', async () => { reads++; return ref; });
  for (let i = 0; i < 20; i++) {
    assert.equal(c.decodedThumbnail('a', 'asset', 'signed-old'), ref);
    await c.retainDecodedThumbnail('a', 'asset', 'signed-old', async () => { reads++; return ref; });
  }
  assert.equal(reads, 1);
  assert.equal(c.decodedThumbnail('a', 'asset', 'signed-new'), undefined);
});
test('account switch and cleanup reject in-flight old-account native reads', async () => {
  const c = cache(); let resolve;
  const pending = c.retainDecodedThumbnail('a', 'asset', 'url', () => new Promise(r => resolve = r));
  assert.equal(c.decodedThumbnail('b', 'asset', 'url'), undefined);
  resolve(image()); await pending;
  assert.equal(c.decodedThumbnail('a', 'asset', 'url'), undefined);
  await c.retainDecodedThumbnail('a', 'asset', 'url', async () => image());
  c.clearDecodedThumbnails(); assert.equal(c.decodedThumbnail('a', 'asset', 'url'), undefined);
});
test('native reference budget evicts oldest entries and rejects oversized images', async () => {
  const c = cache();
  for (let i = 0; i < 100; i++) await c.retainDecodedThumbnail('a', 'asset'+i, 'url'+i, async () => ({ width: 100, height: 100, scale: 1 }));
  assert.equal(c.decodedThumbnail('a', 'asset0', 'url0'), undefined);
  assert.ok(c.decodedThumbnail('a', 'asset99', 'url99'));
  await c.retainDecodedThumbnail('a', 'huge', 'huge', async () => ({ width: 5000, height: 5000, scale: 1 }));
  assert.equal(c.decodedThumbnail('a', 'huge', 'huge'), undefined);
  for (let i = 0; i < 10; i++) await c.retainDecodedThumbnail('a', 'large'+i, 'large'+i, async () => ({ width: 2048, height: 2048, scale: 1 }));
  assert.equal(c.decodedThumbnail('a', 'large7', 'large7'), undefined);
  assert.ok(c.decodedThumbnail('a', 'large8', 'large8'));
  assert.ok(c.decodedThumbnail('a', 'large9', 'large9'));
});
test('failed native cache reads fall back without retaining invalid references', async () => {
  const c = cache();
  await c.retainDecodedThumbnail('a', 'asset', 'url', async () => { throw new Error('missing'); });
  assert.equal(c.decodedThumbnail('a', 'asset', 'url'), undefined);
});
