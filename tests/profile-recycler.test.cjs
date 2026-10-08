const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve('node_modules/@shopify/flash-list/src');
const modules = new Map();
// Execute the installed recycler algorithms, rather than a replacement list mock.
function load(file) {
  const filename = path.resolve(file);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} }; modules.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => {
    if (name === 'react-native') return { PixelRatio: { roundToNearestPixel: value => Math.round(value * 3) / 3, getPixelSizeForLayoutSize: value => Math.round(value * 3) } };
    assert.ok(name.startsWith('.'), name);
    return load(path.resolve(path.dirname(filename), name) + '.ts');
  }) });
  return module.exports;
}
const { RenderStackManager } = load(path.join(root, 'recyclerview/RenderStackManager.ts'));
const { ConsecutiveNumbers } = load(path.join(root, 'recyclerview/helpers/ConsecutiveNumbers.ts'));
const { RVGridLayoutManagerImpl } = load(path.join(root, 'recyclerview/layout-managers/GridLayoutManager.ts'));
function keys(manager) { return new Map([...manager.getRenderStack()].map(([key, value]) => [value.stableId, key])); }

test('installed per-post recycler keeps native holder keys across prepend, edit, delete and rollback', () => {
  const manager = new RenderStackManager(18);
  let data = Array.from({ length: 100 }, (_, index) => ({ id: `post-${index}` }));
  const sync = () => manager.sync(index => data[index].id, () => 'journey', new ConsecutiveNumbers(0, 20), data.length);
  sync(); const original = keys(manager);
  data = [{ id: 'new-post' }, ...data]; sync();
  let current = keys(manager);
  for (let index = 0; index < 18; index++) assert.equal(current.get(`post-${index}`), original.get(`post-${index}`));
  data = data.map(item => item.id === 'post-3' ? { ...item, title: 'Edited' } : item); sync();
  assert.equal(keys(manager).get('post-3'), original.get('post-3'));
  const beforeDelete = data; data = data.filter(item => item.id !== 'post-5'); sync(); current = keys(manager);
  for (let index = 0; index < 18; index++) if (index !== 5) assert.equal(current.get(`post-${index}`), original.get(`post-${index}`));
  data = beforeDelete; sync(); current = keys(manager);
  for (let index = 0; index < 18; index++) if (index !== 5) assert.equal(current.get(`post-${index}`), original.get(`post-${index}`));
});

test('installed recycler limits retained offscreen holders while traversing 500 posts', () => {
  const manager = new RenderStackManager(18);
  for (let start = 0; start < 480; start += 18) {
    manager.sync(index => `post-${index}`, () => 'moment', new ConsecutiveNumbers(start, start + 17), 500);
    assert.ok(manager.getRenderStack().size <= 36, '18 engaged plus at most 18 pooled holders');
  }
});

for (const kind of ['journey', 'moment']) for (const count of [0, 1, 5, 20, 100, 500]) test(`installed grid extent ends at its actual final row; ${kind}, posts=${count}`, () => {
  const width = 390;
  const height = kind === 'journey' ? (width - 4) / 3 + 2 : (width - 6) / 3 / .68 + 2;
  const manager = new RVGridLayoutManagerImpl({ windowSize: { width, height: 844 }, maxColumns: 3, getItemType: () => kind, overrideItemLayout: () => {} });
  const measure = n => Array.from({ length: n }, (_, index) => ({ index, dimensions: { width: width / 3, height } }));
  manager.modifyLayout([], count);
  manager.modifyLayout(measure(count), count);
  assert.equal(manager.getLayoutCount(), count);
  assert.ok(Math.abs(manager.getLayoutSize().height - Math.ceil(count / 3) * height) < 1e-6);
  if (count) {
    const last = manager.getLayout(count - 1);
    assert.ok(Math.abs(manager.getLayoutSize().height - (last.y + last.height)) < 1e-6);
  }
  // A large profile must shrink immediately with deletion, including to empty.
  manager.modifyLayout(measure(Math.min(count, 5)), Math.min(count, 5));
  assert.ok(Math.abs(manager.getLayoutSize().height - Math.ceil(Math.min(count, 5) / 3) * height) < 1e-6);
  manager.modifyLayout([], 0); assert.equal(manager.getLayoutSize().height, 0);
});

test('recycled Journey and Moment cells reset buffered images when their post identity changes', () => {
  const journey = fs.readFileSync('src/features/profile/components/ProfileJourneyGrid.tsx', 'utf8');
  const moment = fs.readFileSync('src/features/moments/MomentGrid.tsx', 'utf8');
  assert.match(journey, /<StableCachedImage key=\{journey.id\}/);
  assert.match(moment, /<StableCachedImage key=\{item.id\}/);
});
