const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function hooks() {
  const slots = []; let cursor = 0; let effects = [];
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
  const React = {
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useState(value) { const index = cursor++; if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useMemo(fn, deps) { const index = cursor++; if (!slots[index] || !equal(slots[index].deps, deps)) slots[index] = { value: fn(), deps }; return slots[index].value; },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const index = cursor++; if (!slots[index] || !equal(slots[index].deps, deps)) { slots[index]?.cleanup?.(); slots[index] = { deps }; effects.push(() => { slots[index].cleanup = fn(); }); } },
    useSyncExternalStore(_subscribe, get) { return get(); },
    memo: component => component,
  };
  return { React, render(fn) { cursor = 0; effects = []; const tree = fn(); effects.forEach(effect => effect()); return tree; } };
}
function load(file, mocks) {
  mocks = { '@/features/media/components/JourneyThumbnailImage': { JourneyThumbnailImage: 'JourneyImage' }, ...mocks };
  if (file.endsWith('/MomentGrid.tsx')) mocks = { '@/utils/urlRenewal': load('src/utils/urlRenewal.ts', {}), '@/utils/refreshOutcome': load('src/utils/refreshOutcome.ts', {}), ...mocks };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => { if (!(name in mocks)) throw Error(name); return mocks[name]; }) });
  return module.exports;
}
test('Moments loads on first activation only; repeated tab switches do not revalidate even stale data', async () => {
  const h = hooks(); let calls = 0, loaded = false;
  const store = { subscribe: () => () => {}, getSnapshot: () => ({ items: [], loaded, loading: false, loadingMore: false, error: null, updatedAt: 0 }), refresh: async () => { calls++; loaded = true; }, loadMore: async () => {} };
  const { MomentGrid } = load('src/features/moments/MomentGrid.tsx', {
    react: h.React, 'react/jsx-runtime': jsx, 'expo-router': { router: {}, useFocusEffect: fn => h.React.useEffect(fn, [fn]) },
    '@expo/vector-icons/Ionicons': { __esModule: true, default: 'Icon' }, '@/features/media/components/StableCachedImage': { StableCachedImage: props => jsx.jsx('Image', { ...props, source: { uri: props.uri } }) }, 'expo-image': { Image: 'Image' },
    'react-native': { ActivityIndicator: 'Loading', Pressable: 'Pressable', RefreshControl: 'Refresh', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles, absoluteFill: {} } },
    'react-native-reanimated': { __esModule: true, default: { FlatList: 'List' } },
    '@/features/auth/AuthProvider': { useAuth: () => ({ user: { id: 'owner' } }) },
    '@/features/media/imageUrl': {}, './gridCache': { momentGridFor: () => store }, './api': { momentsApi: {} },
    '@/features/profile/theme': { useProfileTheme: () => ({ muted: '#777', placeholder: '#333' }) }, '@/features/profile/components/ProfileMediaTabs': {},
  });
  const render = active => h.render(() => MomentGrid({ filter: { owner_id: 'owner' }, active, embedded: true, embeddedWidth: 390 }));
  render(false); assert.equal(calls, 0); render(true); await Promise.resolve(); assert.equal(calls, 1);
  for (let i = 0; i < 20; i++) render(Boolean(i % 2));
  assert.equal(calls, 1);
});
test('Profile has one header-owning virtualized list with actual content sizing', () => {
  const source = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8');
  assert.equal((source.match(/<ProfileGridList/g) || []).length, 1);
  assert.equal((source.match(/ListHeaderComponent=\{listHeader\}/g) || []).length, 1);
  assert.ok(source.includes("data={collection === 'journeys' ? journeyCells : momentCells}"));
  assert.ok(source.includes('style={StyleSheet.flatten(style)}'));
  assert.ok(source.includes('getItemType={cellType}'));
  assert.ok(source.includes('numColumns={3}'));
  assert.ok(source.includes('maxItemsInRecyclePool={18}'));
  assert.ok(source.includes('scroll: { flex: 1'));
  assert.ok(source.includes('paddingBottom: navigationBottom(insets.bottom) + NAVIGATION_HEIGHT'));
  for (const removed of ['hiddenCollection', 'momentsVisited', 'PROFILE_LIST_STYLE', 'viewportHeight', 'tabContentHeight', 'PagerView', '<Animated.ScrollView', '<MomentGrid embedded', 'loadAlbums', 'Unfinished', 'All Journeys']) assert.ok(!source.includes(removed), removed);
});

function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props), type);
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}
for (const dark of [false, true]) test(`real-shaped cached Moments render with nonzero tile geometry and open the playback route; dark=${dark}`, () => {
  const h = hooks(); let requests = 0; const routes = [];
  const item = { id: 'published-video', cover_url: 'https://media.test/cover.jpg', video_url: 'https://media.test/video.mp4', place: { name: 'Istanbul', locality: 'Istanbul' } };
  const snapshot = { items: [item], loaded: true, loading: false, loadingMore: false, error: null };
  const store = { subscribe: () => () => {}, getSnapshot: () => snapshot, refresh: async () => { requests++; }, loadMore: async () => {} };
  const { MomentGrid } = load('src/features/moments/MomentGrid.tsx', {
    react: h.React, 'react/jsx-runtime': jsx, 'expo-router': { router: { push: route => routes.push(route) }, useFocusEffect: fn => h.React.useEffect(fn, [fn]) },
    '@expo/vector-icons/Ionicons': { __esModule: true, default: 'Icon' }, '@/features/media/components/StableCachedImage': { StableCachedImage: props => jsx.jsx('Image', { ...props, source: { uri: props.uri } }) }, 'expo-image': { Image: 'Image' },
    'react-native': { ActivityIndicator: 'Loading', Pressable: 'Pressable', RefreshControl: 'Refresh', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles, absoluteFill: {} } },
    'react-native-reanimated': { __esModule: true, default: { FlatList: 'List' } },
    '@/features/auth/AuthProvider': { useAuth: () => ({ user: { id: 'owner' } }) },
    '@/features/media/imageUrl': { cachedImageSource: uri => ({ uri }) }, './gridCache': { momentGridFor: () => store }, './api': { momentsApi: {} },
    '@/features/profile/theme': { useProfileTheme: () => ({ muted: '#777', placeholder: dark ? '#333' : '#eee' }) }, '@/features/profile/components/ProfileMediaTabs': {},
  });
  const render = active => h.render(() => MomentGrid({ filter: { owner_id: 'owner' }, active, embedded: true, embeddedWidth: 390 }));
  let tree = render(false);
  for (let i = 0; i < 12; i++) {
    tree = render(Boolean(i % 2));
    const tiles = nodes(tree, 'Pressable'); assert.equal(tiles.length, 1);
    const geometry = Object.assign({}, ...tiles[0].props.style);
    assert.equal(geometry.width, 128); assert.ok(geometry.height > 188 && geometry.height < 189);
    assert.equal(geometry.flex, undefined); assert.equal(geometry.flexShrink, 0);
    assert.equal(nodes(tree, 'Image')[0].props.source.uri, item.cover_url);
    assert.equal(nodes(tree, 'Loading').length, 0);
    assert.ok(!nodes(tree, 'Text').some(text => text.props.children === 'Unfinished'));
  }
  assert.equal(requests, 0);
  nodes(tree, 'Pressable')[0].props.onPress(); assert.equal(routes[0].pathname, '/moment/[id]');
  assert.equal(routes[0].params.id, item.id); assert.equal(routes[0].params.ownerId, 'owner');
  snapshot.loaded = false; snapshot.items = []; snapshot.loading = true;
  tree = render(true); assert.equal(nodes(tree, 'Loading').length, 1);
});

for (const dark of [false, true]) test(`existing Journey rows retain drafts, covers and navigation; dark=${dark}`, () => {
  const h = hooks(); const routes = [], opened = []; let reads = 0;
  const draft = { requestId: 'draft-id', updatedAt: '2026-10-04T10:00:00Z', values: { title: 'Saved trip', destination: 'Istanbul' }, coverKey: 'photo', photos: [{ key: 'photo', uri: 'file:///saved-draft.jpg' }] };
  const journey = { id: 'journey-id', title: 'Published trip', cover_media_url: 'https://media.test/journey.jpg', media: [] };
  const { ProfileJourneyRows } = load('src/features/profile/components/ProfileJourneyRows.tsx', {
    react: h.React, 'react/jsx-runtime': jsx,
    'expo-router': { router: { push: route => routes.push(route) }, useFocusEffect: fn => h.React.useEffect(fn, [fn]) },
    '@expo/vector-icons/Ionicons': { __esModule: true, default: 'Icon' }, '@/features/media/components/StableCachedImage': { StableCachedImage: props => jsx.jsx('Image', { ...props, source: { uri: props.uri } }) }, 'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'react-native': { ActivityIndicator: 'Loading', Alert: {}, Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'Scroll', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles, absoluteFill: {} } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
    '@/features/journeys/draftStorage': { listDrafts: () => { reads++; return [draft]; }, clearDraft: async () => {} },
    '@/features/media/imageUrl': { cachedImageSource: uri => ({ uri }) }, './TravelProfileContent': { profileRelativeDate: () => 'Today' },
  });
  const render = () => h.render(() => ProfileJourneyRows({ userId: 'owner', journeys: [journey], theme: { ink: dark ? '#fff' : '#111', muted: '#777', placeholder: '#eee' }, onOpen: item => opened.push(item) }));
  render(); let tree;
  for (let i = 0; i < 10; i++) {
    tree = render();
    const texts = nodes(tree, 'Text').map(text => text.props.children);
    assert.ok(texts.includes('Unfinished')); assert.ok(texts.includes('All Journeys')); assert.ok(texts.includes('Istanbul'));
    const images = nodes(tree, 'Image').map(image => image.props.source.uri);
    assert.ok(images.includes('file:///saved-draft.jpg')); assert.ok(images.includes(journey.cover_media_url));
  }
  assert.equal(reads, 1);
  nodes(tree, 'Pressable').find(button => button.props.accessibilityLabel === 'Resume Saved trip').props.onPress();
  assert.equal(routes[0].params.draftId, draft.requestId);
  nodes(tree, 'Pressable').find(button => button.props.accessibilityLabel === 'Open Published trip').props.onPress();
  assert.equal(opened[0], journey);
});

for (const dark of [false, true]) test(`Profile published Journey grid is full width, three square columns and has no section copy; dark=${dark}`, () => {
  const h = hooks(), opened = [];
  const journeys = Array.from({ length: 7 }, (_, i) => ({ id: `published-${i}`, title: `Trip ${i}`, cover_media_url: `https://media.test/cover-${i}.jpg`, media: [] }));
  journeys.push({ id: 'in-progress', title: 'Interrupted publish', cover_media_url: 'https://media.test/draft.jpg', media: [] });
  const { ProfileJourneyGrid } = load('src/features/profile/components/ProfileJourneyGrid.tsx', {
    react: h.React, 'react/jsx-runtime': jsx, '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-router': { useFocusEffect: fn => h.React.useEffect(fn, [fn]) },
    '@/features/media/components/StableCachedImage': { StableCachedImage: props => jsx.jsx('Image', { ...props, source: { uri: props.uri } }) }, 'expo-image': { Image: 'Image' },
    'react-native': { ActivityIndicator: 'Loading', Pressable: 'Pressable', View: 'View', StyleSheet: { create: styles => styles, absoluteFill: {} } },
    '@/features/journeys/draftStorage': { listDrafts: () => [{ journeyId: 'in-progress' }] },
    '@/features/media/imageUrl': { cachedImageSource: (uri, cacheKey) => ({ uri, cacheKey }) },
  });
  const props = { userId: 'owner', journeys, width: 390, theme: { placeholder: dark ? '#333' : '#eee', muted: '#777' }, loading: false, onOpen: journey => opened.push(journey) };
  for (let i = 0; i < 10; i++) {
    const tree = h.render(() => ProfileJourneyGrid(props));
    assert.equal(tree.props.style.width, '100%'); assert.equal(tree.props.style.gap, 2);
    const cells = nodes(tree, 'Pressable'); assert.equal(cells.length, 7);
    cells.forEach(cell => { assert.equal(cell.props.style.width, cell.props.style.height); assert.equal(cell.props.style.width * 3 + 4, 390); assert.equal(cell.props.style.borderRadius, undefined); });
    assert.equal(nodes(tree, 'Text').length, 0); assert.equal(nodes(tree, 'Loading').length, 0);
    assert.equal(nodes(tree, 'Image')[0].props.source.uri, journeys[0].cover_media_url);
    cells[0].props.onPress(); assert.equal(opened.at(-1), journeys[0]);
  }
  const source = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8');
  assert.ok(!source.includes('ProfileJourneyRows')); assert.ok(!source.includes('/journey/drafts'));
  assert.ok(!source.includes('All Journeys')); assert.ok(!source.includes('Unfinished')); assert.ok(!source.includes('See all'));
  assert.ok(source.includes('draftCount={0}'));
});
