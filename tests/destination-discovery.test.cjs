const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, URLSearchParams, AbortController, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  return module.exports;
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const rn = { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'Scroll', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute' } } };
const shape = { postMediaShape: { borderRadius: 22, borderCurve: 'continuous' } };
const page = items => ({ items, next_cursor: null });
const destination = { id: 'normalized-city', name: 'A long destination name', country: 'Italy', latitude: '45', longitude: '9', cover_url: null };
const results = () => ({ place: destination, journeys: page([]), stays: page([]), moments: page([]) });
const flush = () => new Promise(resolve => setImmediate(resolve));
test('Explore requests preserve auth, query encoding, category cursors and cancellation', async () => {
  const calls = [], controller = new AbortController();
  const { exploreApi } = load('src/features/explore/api.ts', { '@/api/client': { apiRequest: async (path, options) => { calls.push({ path, options }); return path.startsWith('/explore/destinations?') ? page([destination]) : { query: 'Milan', users: page([]), journeys: page([]), stays: page([]), places: page([]) }; } } });
  const response = await exploreApi.search('Milan & Italy', 'all', null, controller.signal);
  assert.equal(response.places.items[0].id, 'normalized-city');
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.options.authenticated && call.options.signal === controller.signal));
  assert.equal(new URLSearchParams(calls[0].path.split('?')[1]).get('q'), 'Milan & Italy');
  await exploreApi.search('Milan', 'stays', 'stay-cursor', controller.signal);
  assert.equal(new URLSearchParams(calls[2].path.split('?')[1]).get('cursor'), 'stay-cursor');
  await exploreApi.destination('city/id', 'moments', 'moment-cursor', controller.signal);
  assert.ok(calls[3].path.startsWith('/explore/destinations/city%2Fid?'));
});
for (const dark of [false, true]) test(`no-photo destinations are intentional; Moment previews open existing viewer, dark=${dark}`, () => {
  const routes = [];
  const { DestinationCard, MomentPreviews } = load('src/features/explore/DiscoveryContent.tsx', {
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'expo-router': { router: { push: value => routes.push(value) } }, react: {}, 'react/jsx-runtime': jsx, 'react-native': rn,
    '@/features/media/imageUrl': { cachedImageSource: uri => ({ uri }) }, '@/features/posts/mediaShape': shape,
    '@/features/stays/StayCard': { StayCard: 'StayCard' }, '@/features/stays/StayDetail': { StayDetail: 'StayDetail' }, '@/features/stays/api': {}, '@/features/world/viewport': {},
  });
  const theme = { dark, ink: 'ink', muted: 'muted', elevatedSurface: dark ? 'dark-surface' : 'light-surface' };
  const card = DestinationCard({ place: destination, theme, onPress() {} });
  assert.equal(nodes(card, n => n.type === 'Image').length, 0);
  assert.equal(nodes(card, n => n.type === 'Gradient').length, 0);
  assert.equal(card.props.style({ pressed: false })[1].backgroundColor, theme.elevatedSurface);
  const moments = MomentPreviews({ items: [{ id: 'real-moment', creator: { username: 'traveler' }, cover_url: 'actual-cover' }], theme });
  nodes(moments, n => n.type === 'Pressable')[0].props.onPress();
  assert.equal(routes[0], '/moment/real-moment');
  assert.equal(nodes(moments, n => n.type === 'Image')[0].props.source.uri, 'actual-cover');
});
function screenHarness(fetcher) {
  let index = 0, focused, cleanup;
  const slots = [], routes = [];
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = index++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback: fn => fn,
  };
  const { PlaceExploreScreen } = load('src/features/explore/PlaceExploreScreen.tsx', {
    react, 'react/jsx-runtime': jsx, 'react-native': rn, 'react-native-safe-area-context': { SafeAreaView: 'Safe' },
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'expo-router': { router: { push: value => routes.push(value), back() {} }, useFocusEffect: fn => { focused = fn; } },
    '@/features/discover/components/DiscoverJourneyCard': { DiscoverJourneyCard: 'Journey' }, '@/features/media/imageUrl': { cachedImageSource: uri => ({ uri }) },
    '@/features/profile/theme': { useProfileTheme: () => ({ dark: false, ink: 'ink', muted: 'muted', elevatedSurface: 'surface' }) },
    '@/features/stays/StayGlass': { GlassButton: 'Glass' }, '@/features/world/viewport': { worldMapTarget: (scope, lat, lon) => ({ scope, lat, lon }) },
    './api': { exploreApi: { destination: fetcher } }, './DiscoveryContent': { MomentPreviews: 'Moments', SearchSkeleton: 'Skeleton', StayResults: 'Stays' },
  });
  return { render() { index = 0; return PlaceExploreScreen({ id: destination.id }); }, focus() { cleanup?.(); cleanup = focused(); }, routes };
}
test('destination tabs cancel obsolete requests and keep identity while loading; map uses actual coordinates', async () => {
  const pending = [];
  const h = screenHarness((id, type, cursor, signal) => new Promise(resolve => pending.push({ id, type, cursor, signal, resolve })));
  h.render(); h.focus();
  pending[0].resolve(results()); await flush();
  let tree = h.render();
  nodes(tree, n => n.type === 'Glass' && n.props.label === 'View destination on map')[0].props.onPress();
  assert.equal(h.routes[0].lat, 45); assert.equal(h.routes[0].lon, 9);
  nodes(tree, n => n.props?.accessibilityRole === 'tab')[2].props.onPress(); tree = h.render(); h.focus();
  assert.equal(pending[0].signal.aborted, true); assert.equal(pending[1].type, 'stays');
  assert.equal(nodes(h.render(), n => n.props?.children === destination.name).length, 1);
  pending[1].resolve({ ...results(), stays: page([{ id: 'real-stay', photos: [] }]) }); await flush();
  tree = h.render(); assert.equal(nodes(tree, n => n.type === 'Stays')[0].props.items[0].id, 'real-stay');
});
test('destination failure removes unvalidated content and retry restores a clean empty state', async () => {
  let fail = true;
  const h = screenHarness(async () => { if (fail) throw Error('offline'); return results(); });
  h.render(); h.focus(); await flush();
  assert.equal(nodes(h.render(), n => n.props?.accessibilityRole === 'alert').length, 1);
  fail = false;
  nodes(h.render(), n => n.type === 'Pressable' && nodes(n, child => child.props?.children === 'Retry').length)[0].props.onPress(); await flush();
  const tree = h.render(); assert.equal(nodes(tree, n => n.props?.accessibilityRole === 'alert').length, 0);
  assert.equal(nodes(tree, n => n.props?.children === 'No public traveler content here yet.').length, 1);
});

for (const dark of [false, true]) test(`Search chips have exact order, compact materials and exclusive results: dark=${dark}`, () => {
  const state = { query: '', category: 'all', loading: false, more: null, error: null, results: {
    query: '', places: { items: [destination], next_cursor: null },
    journeys: { items: [{ id: 'journey' }], next_cursor: null },
    stays: { items: [{ id: 'stay', photos: [] }], next_cursor: null },
    users: { items: [{ id: 'creator', username: 'traveler', display_name: 'Traveler', avatar_url: null }], next_cursor: null },
    moments: { items: [{ id: 'moment' }], next_cursor: null },
  } };
  const theme = { dark, ink: 'ink', muted: 'muted', placeholder: dark ? 'dark-gray' : 'system-gray', border: 'neutral-outline', elevatedSurface: 'surface' };
  const store = { subscribe() {}, getSnapshot: () => state, setCategory: category => { state.category = category; }, setQuery: query => { state.query = query; }, refresh() {}, suspend() {} };
  const { ExploreScreen } = load('src/features/explore/ExploreScreen.tsx', {
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    'expo-router': { router: { push() {} }, useFocusEffect() {} },
    react: { useCallback: fn => fn, useEffect() {}, useMemo: fn => fn(), useState: value => [value, () => {}], useSyncExternalStore: (_, get) => get() },
    'react/jsx-runtime': jsx, 'react-native': { ...rn, FlatList: 'List', Keyboard: { dismiss() {} } },
    'react-native-safe-area-context': { SafeAreaView: 'Safe' },
    '@/features/discover/components/DiscoverJourneyCard': { DiscoverJourneyCard: 'Journey' },
    '@/features/follows/FollowButton': { FollowButton: 'Follow' }, '@/features/profile/components/ProfileAvatarImage': { ProfileAvatarImage: 'Avatar' },
    '@/features/profile/theme': { useProfileTheme: () => theme }, '@/features/search/LibrarySearchScreen': { default: 'Library' },
    '@/features/search/storage': { recentSearchStorage: {} }, '@/features/search/utils': { addRecentSearch() {} },
    './api': { exploreApi: { search() {} } }, './store': { createExploreStore: () => store },
    './ForYouGrid': { ForYouGrid: 'ForYouGrid' },
    './DiscoveryContent': { DestinationCard: 'Destination', MomentPreviews: 'Moments', SearchSkeleton: 'Skeleton', StayResults: 'Stays' },
  });
  let tree = ExploreScreen();
  const chips = nodes(tree, n => n.props?.accessibilityRole === 'tab');
  assert.deepEqual(chips.map(chip => nodes(chip, n => n.type === 'Text')[0].props.children), ['For you', 'Places', 'Journeys', 'Stays', 'Profiles', 'Moments']);
  const row = nodes(tree, n => n.type === 'Scroll' && n.props.horizontal)[0];
  assert.equal(row.props.showsHorizontalScrollIndicator, false);
  assert.equal(row.props.contentContainerStyle.flexWrap, undefined);
  assert.equal(chips[0].props.style.minHeight, 44);
  assert.equal(chips[0].props.children.props.style[1].backgroundColor, theme.placeholder);
  assert.equal(chips[0].props.children.props.style[1].borderWidth, 0);
  assert.equal(chips[1].props.children.props.style[1].borderWidth, 1);
  assert.equal(chips[1].props.children.props.style[1].backgroundColor, 'transparent');
  assert.equal(nodes(tree, n => n.type === 'ForYouGrid').length, 1);
  for (const query of ['', 'milan']) for (const [index, category] of ['all', 'places', 'journeys', 'stays', 'users', 'moments'].entries()) {
    state.query = query;
    chips[index].props.onPress();
    tree = ExploreScreen();
    assert.equal(state.query, query);
    if (category === 'all') { assert.equal(nodes(tree, n => n.type === 'ForYouGrid')[0].props.query, query); continue; }
    const list = nodes(tree, n => n.type === 'List')[0];
    const expected = [category];
    assert.deepEqual(Array.from(list.props.data, item => item.category), expected);
    if (category !== 'all') {
      const content = list.props.renderItem({ item: list.props.data[0] });
      assert.equal(nodes(content, n => n.type === 'Text' && n.props.style?.[0]?.fontSize === 21).length, 0, 'Filtered experience must not repeat the chip as a section heading');
    }
  }
});
