const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function evaluate(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, Set, Map, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  return module.exports;
}
const api = evaluate('src/features/travel/api.ts', { '@/api/client': { apiRequest() {} } });
const sample = {
  stats: { countries: 1, continents: 1, country_total: 197, world_percentage: .5, unassigned_journeys: 0 },
  countries: [{ code: 'IT', name: 'Italy', continent: 'Europe', journey_count: 3, photo_count: 47, cities: ['Milan', 'Rome'], last_visited: '2026-01-01', cover_url: 'https://real-cover.test/photo' }],
  continents: [{ name: 'Europe', countries_visited: 1, country_total: 45 }], recently_visited: ['IT'],
};
function mount(fetch, country = false) {
  const hooks = []; let cursor = 0, effects = []; const navigation = [];
  const jsx = (type, props) => ({ type, props });
  const slot = initial => { const index = cursor++; if (!(index in hooks)) hooks[index] = initial(); return index; };
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  const react = {
    useState(value) { const i = slot(() => typeof value === 'function' ? value() : value); return [hooks[i], update => { hooks[i] = typeof update === 'function' ? update(hooks[i]) : update; }]; },
    useRef(value) { return hooks[slot(() => ({ current: value }))]; },
    useMemo(fn, deps) { const i = slot(() => null); if (!hooks[i] || !equal(hooks[i].deps, deps)) hooks[i] = { deps, value: fn() }; return hooks[i].value; },
    useCallback(fn, deps) { return this.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const i = slot(() => null); if (!hooks[i] || !equal(hooks[i], deps)) effects.push(fn); hooks[i] = deps; },
  };
  // Hook calls use standalone imports.
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  class Value { interpolate() { return 0; } }
  const mocks = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-image': { Image: 'Image' }, 'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-router': { router: { push: value => navigation.push(value), replace: value => navigation.push(value), canGoBack: () => false }, useFocusEffect: fn => react.useEffect(fn, [fn]), useLocalSearchParams: () => ({ code: 'IT' }) },
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'Modal', 'Pressable', 'RefreshControl', 'ScrollView', 'FlatList', 'Text', 'View'].map(v => [v, v])), Animated: { Value, View: 'AnimatedView', timing: () => ({ start() {} }) }, PanResponder: { create: () => ({ panHandlers: {} }) }, StyleSheet: { create: x => x, absoluteFill: {} } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }, 'react-native-reanimated': { useReducedMotion: () => true },
    '@/features/navigation/TabBarScrollContext': { useTabBarController: () => ({ expand }) },
    '@/features/profile/theme': { useProfileTheme: () => ({ dark: false, canvas: '#fff', ink: '#111', muted: '#777', accent: '#2F95FF' }) },
    '@/features/media/imageUrl': { cachedImageSource: uri => ({ uri }) }, '@/utils/format': { formatDateRange: () => 'Real dates' },
    './api': { ...api, travelApi: { progress: fetch, journeys: fetch } }, './PassportMap': { PassportMap: 'PassportMap' },
  };
  function expand() {}
  const Component = evaluate(country ? 'src/features/travel/CountryScreens.tsx' : 'src/features/travel/MyWorldScreen.tsx', mocks)[country ? 'CountryScreen' : 'MyWorldScreen'];
  return { render() { cursor = 0; effects = []; const tree = Component({}); effects.forEach(fn => fn()); return tree; }, navigation };
}
function nodes(tree, predicate) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(x => nodes(x, predicate)); return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]; }
const byType = (tree, type) => nodes(tree, n => n.type === type);
const pressText = (tree, value) => nodes(tree, n => n.type === 'Pressable' && nodes(n, t => t.type === 'Text' && t.props.children === value).length)[0].props.onPress();
const flush = () => new Promise(resolve => setImmediate(resolve));
test('screen derives statistics and country sheet from aggregate; routes to filtered journeys', async () => {
  let calls = 0; const app = mount(async () => { calls++; return sample; });
  app.render(); await flush(); let tree = app.render();
  assert.equal(calls, 1);
  assert.ok(nodes(tree, n => n.type === 'Text' && n.props.children === '1 country · 1 continent').length);
  const map = byType(tree, 'PassportMap')[0]; assert.equal(map.props.visited.has('IT'), true); assert.equal(map.props.visited.has('JP'), false);
  map.props.onCountry('IT', 'Italy'); tree = app.render();
  assert.equal(byType(tree, 'Modal')[0].props.visible, true);
  assert.ok(nodes(tree, n => n.type === 'Text' && [n.props.children].flat().join('') === '3 journeys · 47 photos').length);
  pressText(tree, 'View journeys →');
  assert.equal(app.navigation[0].pathname, '/world/country'); assert.equal(app.navigation[0].params.code, 'IT');
});
test('unvisited country and continent switch do not issue per-country requests', async () => {
  let calls = 0; const app = mount(async () => { calls++; return sample; }); app.render(); await flush();
  byType(app.render(), 'PassportMap')[0].props.onCountry('JP', 'Japan');
  assert.ok(nodes(app.render(), n => n.type === 'Text' && n.props.children === 'Not visited yet').length);
  pressText(app.render(), 'Continents');
  assert.equal(byType(app.render(), 'PassportMap')[0].props.mode, 'continents'); assert.equal(calls, 1);
});
test('failed aggregate can retry and empty state offers journey creation', async () => {
  let calls = 0; const app = mount(async () => { if (++calls === 1) throw Error('Offline'); return { ...sample, stats: { ...sample.stats, countries: 0, continents: 0, world_percentage: 0 }, countries: [], recently_visited: [] }; });
  app.render(); await flush(); pressText(app.render(), 'Couldn’t load your world. Tap to retry.'); await flush();
  pressText(app.render(), 'Create a journey →'); assert.equal(app.navigation[0], '/journey/new'); assert.equal(calls, 2);
});
test('country journey screen opens the real owner post route', async () => {
  const app = mount(async () => ({ country: sample.countries[0], journeys: [{ id: 'actual-id', title: 'Milan weekend', destination: 'Milan', start_date: '2026-01-01', end_date: '2026-01-03', cover_url: null }] }), true);
  app.render(); await flush(); const list = byType(app.render(), 'FlatList')[0];
  const row = list.props.renderItem({ item: list.props.data[0] }); row.props.onPress();
  assert.equal(app.navigation[0].pathname, '/post/[id]'); assert.equal(app.navigation[0].params.id, 'actual-id'); assert.equal(app.navigation[0].params.scope, 'own');
});
test('all selectable countries have geometry and plural labels are correct', () => {
  const countries = [...fs.readFileSync('src/features/journeys/countries.ts', 'utf8').matchAll(/code: '([A-Z]{2})'/g)].map(m => m[1]);
  const geometry = JSON.parse(fs.readFileSync('src/features/travel/worldGeometry.json'));
  for (const code of countries) assert.ok(geometry.some(c => c.code === code), code);
  assert.equal(api.countLabel(0, 'country'), '0 countries'); assert.equal(api.countryFlag('IT'), '🇮🇹');
});
