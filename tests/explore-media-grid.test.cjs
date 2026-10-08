const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(path, mocks = {}) { const mod = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports: mod.exports, module: mod, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(name in mocks, name); return mocks[name]; }) }); return mod.exports; }
const helpers = load('src/features/explore/mediaGrid.ts');
const tile = (id, type = 'journey') => ({ key: `${type}:${id}`, id, type, url: `https://media.test/${id}` });
test('mixed media excludes missing covers, destinations, users and zero-photo Stays', () => {
  const result = helpers.mediaTiles({ journeys: { items: [{ id: 'a', thumbnail_url: 'thumb', cover_media_url: 'display' }, { id: 'empty', cover_media_url: null }] }, moments: { items: [{ id: 'a', cover_url: 'frame' }] }, stays: { items: [{ id: 's', photos: [{ url: 'real-photo' }], tips: [] }, { id: 'no-photo', tips: [], cover_url: 'legacy-journey-cover' }] } });
  assert.deepEqual(Array.from(result, x => [x.key, x.url]), [['journey:a', 'thumb'], ['moment:a', 'frame'], ['stay:s', 'real-photo']]);
});
test('session mixing is deterministic, changes on refresh and never reorders previous pages', () => {
  const incoming = Array.from({ length: 50 }, (_, i) => tile(String(i), ['journey', 'moment', 'stay'][i % 3]));
  const first = helpers.appendMix([], incoming.slice(0, 20), 'session');
  const next = helpers.appendMix(first, incoming, 'session');
  assert.deepEqual(Array.from(next.slice(0, first.length), x => x.key), Array.from(first, x => x.key));
  assert.equal(new Set(next.map(x => x.key)).size, 50);
  assert.deepEqual(Array.from(helpers.appendMix([], incoming, 'session'), x => x.key), Array.from(helpers.appendMix([], incoming, 'session'), x => x.key));
  assert.notDeepEqual(Array.from(helpers.appendMix([], incoming, 'refresh'), x => x.key), Array.from(helpers.appendMix([], incoming, 'session'), x => x.key));
});
test('layout includes occasional two-row blocks and keeps geometry when pagination fills them', () => {
  const items = Array.from({ length: 60 }, (_, i) => tile(String(i)));
  const short = helpers.mediaBlocks(items.slice(0, 11), 'session');
  const full = helpers.mediaBlocks(items, 'session');
  assert.equal(full[3].tall, true); assert.equal(full[3].items.length, 5);
  assert.equal(full[0].items.length, 3);
  for (let i = 0; i < short.length; i++) { assert.equal(short[i].key, full[i].key); assert.equal(short[i].tall, full[i].tall); assert.equal(short[i].left, full[i].left); }
  assert.equal(full.filter(x => x.tall).length, 3);
});
const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function nodes(value, predicate) { if (!value || typeof value !== 'object') return []; if (Array.isArray(value)) return value.flatMap(x => nodes(x, predicate)); return [...(predicate(value) ? [value] : []), ...nodes(value.props?.children, predicate)]; }
for (const dark of [false, true]) test(`grid routes all media types without text or video players, dark=${dark}`, () => {
  const routes = [], staysOpened = [], journeys = []; let remembered = 0;
  const tiles = [tile('j'), tile('m', 'moment'), { ...tile('s', 'stay'), stay: { id: 's' } }];
  const { ForYouGrid } = load('src/features/explore/ForYouGrid.tsx', {
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-image': { Image: 'Image' }, 'expo-router': { router: { push: x => routes.push(x) } },
    react: { useEffect() {}, useRef: value => ({ current: value && value.tiles ? { ...value, tiles } : value }), useState: value => [typeof value === 'function' ? value() : value === 0 ? 390 : value, () => {}] },
    'react/jsx-runtime': jsx, 'react-native': { ActivityIndicator: 'Loading', FlatList: 'List', Pressable: 'Press', Text: 'Text', View: 'View', StyleSheet: { create: x => x, absoluteFill: { position: 'absolute' } } },
    '@/features/media/imageUrl': { cachedImageSource: (uri, cacheKey) => ({ uri, cacheKey }) }, './DiscoveryContent': { StayResults: 'StayController' }, './mediaGrid': helpers,
  });
  const tree = ForYouGrid({ results: {}, loading: false, more: null, error: null, query: '', theme: { dark, elevatedSurface: 'surface' }, refresh: async () => {}, loadMore: async () => {}, onJourney: id => journeys.push(id), onOpen: () => remembered++ });
  const controller = nodes(tree, x => x.type === 'StayController')[0];
  const list = controller.props.children(stay => staysOpened.push(stay.id));
  assert.equal(list.props.windowSize, 7); assert.ok(list.props.onRefresh); assert.ok(list.props.onEndReached);
  const block = list.props.renderItem({ item: list.props.data[0] });
  const presses = nodes(block, x => x.type === 'Press');
  assert.equal(presses.length, 3);
  assert.equal(presses[0].props.style.width, (390 - 4) / 3);
  assert.equal(nodes(block, x => x.type === 'Text').length, 0);
  assert.equal(nodes(block, x => x.type === 'Image').length, 3);
  presses.forEach(x => x.props.onPress());
  assert.deepEqual(journeys, ['j']); assert.deepEqual(routes, ['/moment/m']); assert.deepEqual(staysOpened, ['s']); assert.equal(remembered, 2);
});
