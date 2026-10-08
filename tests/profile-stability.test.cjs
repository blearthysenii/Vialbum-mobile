const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function harness(file, extra) {
  const slots = []; let cursor, effects, changed;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  const React = {
    memo: fn => fn,
    forwardRef: fn => fn,
    useRef(v) { const i = cursor++; return slots[i] ??= { current: v }; },
    useState(v) { const i = cursor++; if (!(i in slots)) slots[i] = typeof v === 'function' ? v() : v; return [slots[i], next => { const value = typeof next === 'function' ? next(slots[i]) : next; if (value !== slots[i]) { slots[i] = value; changed = true; } }]; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !equal(slots[i].deps, deps)) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => slots[i].cleanup = fn()); } },
    useSyncExternalStore(_subscribe, get) { return get(); },
  };
  React.useCallback = (fn, deps) => React.useMemo(() => fn, deps);
  const mocks = { '@/features/media/components/JourneyThumbnailImage': { JourneyThumbnailImage: 'JourneyImage' }, react: React, 'react/jsx-runtime': jsx, 'expo-image': { Image: 'Image' }, 'react-native': { Platform: { OS: 'android' }, View: 'View', StyleSheet: { absoluteFill: {} } }, '../decodedThumbnailCache': { decodedThumbnail: () => undefined, retainDecodedThumbnail: async () => {} }, '../imageUrl': { cachedImageSource: (uri, namespace) => ({ uri, cacheKey: namespace + ':' + uri.split('?')[0] }) }, ...extra };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { AbortController, __DEV__: false, module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  return { React, exports: module.exports, render(fn) { let tree, count = 0; do { changed = false; cursor = 0; effects = []; tree = fn(); effects.forEach(fn => fn()); assert.ok(++count < 15, 'effects must settle without a render loop'); } while (changed); return tree; } };
}
function images(tree) { return tree?.props.children.filter(Boolean) ?? []; }
function opacity(image) { return image.props.style.at(-1).opacity; }
test('decoded image stays visible while a signed URL changes; replacement swaps only on load', () => {
  const h = harness('src/features/media/components/StableCachedImage.tsx');
  const props = { uri: 'https://media/cover?signature=old', namespace: 'cover', style: {} };
  const render = () => h.render(() => h.exports.StableCachedImage(props));
  let tree = render(); images(tree)[0].props.onDisplay(); tree = render();
  const old = images(tree)[0].props.source;
  props.uri = 'https://media/cover?signature=new'; tree = render();
  assert.equal(images(tree).length, 2); assert.equal(opacity(images(tree)[0]), 1); assert.equal(opacity(images(tree)[1]), 0);
  assert.equal(images(tree)[1].props.source.cacheKey, old.cacheKey);
  assert.equal(images(tree)[1].props.cachePolicy, 'memory-disk');
  images(tree)[1].props.onLoad({}); tree = render();
  assert.equal(opacity(images(tree)[0]), 1, 'download completion must not hide the old image before native display');
  images(tree)[1].props.onDisplay(); tree = render();
  assert.equal(opacity(images(tree)[0]), 0); assert.equal(opacity(images(tree)[1]), 1);
  props.uri = null; assert.equal(render(), null);
  props.uri = 'https://media/new-cover'; tree = render(); assert.equal(images(tree).length, 1);
  assert.equal(images(tree)[0].props.source.uri, props.uri);
});
test('failed replacement retains decoded image, renews once, and ignores obsolete image load events', () => {
  const h = harness('src/features/media/components/StableCachedImage.tsx'); let errors = 0, renewals = 0;
  const props = { uri: 'https://media/old', namespace: 'cover', style: {}, onError: () => errors++, onSourceError: () => renewals++ };
  const render = () => h.render(() => h.exports.StableCachedImage(props));
  let tree = render(); images(tree)[0].props.onDisplay(); tree = render();
  props.uri = 'https://media/failing'; tree = render(); const failed = images(tree)[1];
  failed.props.onError({}); failed.props.onError({}); tree = render();
  assert.equal(errors, 0); assert.equal(renewals, 1); assert.equal(opacity(images(tree)[0]), 1);
  props.uri = 'https://media/replacement'; tree = render(); failed.props.onDisplay(); tree = render();
  assert.equal(opacity(images(tree)[0]), 1); images(tree)[1].props.onDisplay(); tree = render(); assert.equal(opacity(images(tree)[1]), 1);
});
test('Profile Moments use cached navigation data and reconcile only on stale foreground entry', async () => {
  let listener, calls = 0, loaded = true;
  const store = { subscribe: () => () => {}, getSnapshot: () => ({ loaded }), refresh: async () => { calls++; loaded = true; } };
  const h = harness('src/features/moments/useProfileMoments.ts', {
    'react-native': { AppState: { currentState: 'active', addEventListener: (_event, fn) => { listener = fn; return { remove() {} }; } } },
    'expo-router': { useFocusEffect: () => {} },
    './gridCache': { momentGridFor: () => store }, './api': { momentsApi: {} },
  });
  const render = active => h.render(() => h.exports.useProfileMoments('owner', active));
  render(true); for (let i = 0; i < 20; i++) render(Boolean(i % 2)); render(true); assert.equal(calls, 0);
  listener('active'); assert.equal(calls, 0); listener('background'); listener('active'); assert.equal(calls, 1);
  render(false); listener('background'); listener('active'); assert.equal(calls, 1);
});
function profileFixture(dark, count, initialCollection = 'journeys', reduced = false) {
  const timings = [], viewportSnapshots = [];
  let user = { id: 'owner', username: 'traveler', first_name: 'Travel', last_name: 'User', profile_cover_url: 'https://media/profile-cover', profile_photo_url: 'https://media/avatar' };
  let journeys = Array.from({ length: count }, (_, i) => ({ id: `journey-${i}`, title: `Trip ${i}`, cover_media_url: `https://media/journey-${i}`, media: [] }));
  const moments = Array.from({ length: count }, (_, i) => ({ id: `moment-${i}`, cover_url: `https://media/moment-${i}`, place: { name: 'Istanbul' } }));
  const theme = { dark, canvas: dark ? '#000' : '#fff', ink: dark ? '#fff' : '#111', muted: '#777', placeholder: '#eee' };
  const social = { stats: { followers_count: 5, following_count: 3 }, refresh: async () => {} };
  const stored = { items: moments, loaded: true, loading: false, loadingMore: false, error: null };
  let requests = 0, pageRequests = 0;
  const focusEffects = new Set();
  const request = async () => { requests++; };
  const store = { refresh: async () => { requests++; }, loadMore: async () => { pageRequests++; }, refreshItem: async () => {} };
  const noop = () => {}, pull = { heroStyle: {}, onScroll: noop, requestRefresh: noop, syncScrollState: noop, indicator: null };
  let h, profileAdapter;
  const native = { View: 'View', Text: 'Text', Pressable: 'Pressable', Modal: 'Modal', ActivityIndicator: 'Loading', RefreshControl: 'Refresh', StyleSheet: { create: v => v, flatten: value => Array.isArray(value) ? Object.assign({}, ...value.flat(Infinity).filter(Boolean)) : value, absoluteFill: {}, hairlineWidth: .5 }, useColorScheme: () => dark ? 'dark' : 'light', useWindowDimensions: () => ({ width: 390, height: 844 }), AccessibilityInfo: { isReduceMotionEnabled: async () => reduced, addEventListener: () => ({ remove() {} }) } };
  const mocks = {
    '@/features/media/decodedThumbnailCache': { setJourneyThumbnailViewport: (owner, items) => viewportSnapshots.push({ owner, items }) },
    '@/utils/urlRenewal': harness('src/utils/urlRenewal.ts', {}).exports,
    '@/utils/refreshOutcome': harness('src/utils/refreshOutcome.ts', {}).exports,
    'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'Safe', useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) },
    'expo-router': { router: { push: noop }, useFocusEffect: fn => h.React.useEffect(() => { focusEffects.add(fn); const cleanup = fn(); return () => { focusEffects.delete(fn); cleanup?.(); }; }, [fn]) }, 'expo-status-bar': { setStatusBarStyle: noop }, 'expo-haptics': { selectionAsync: async () => {}, impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 1 } },
    '@expo/vector-icons/Ionicons': { __esModule: true, default: 'Icon' }, 'expo-image': { Image: 'Image' },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: component => { profileAdapter = component; return 'ProfileGridList'; } }, useSharedValue: v => h.React.useRef({ value: v, set(next) { this.value = next; } }).current, withTiming: (v, options) => { timings.push(options); return v; } },
    '@shopify/flash-list': { FlashList: 'FlashList' },
    '@/features/moments/MomentGrid': { MomentTile: 'MomentTile', ProfileMediaTabs: 'Tabs' }, '@/features/journeys/components/CreateJourneySheet': { CreateJourneySheet: 'Create' },
    '@/features/follows/useOwnFollowStats': { useOwnFollowStats: () => social }, '@/features/stays/StayGlass': { GlassButton: 'GlassButton' },
    '@/features/profile/dataCache': { cachedProfileAlbums: (_id, data) => data, profileCollection: { get: () => initialCollection, set: noop } }, '@/features/profile/refreshTiming': { profileRefreshTiming: noop },
    '@/features/profile/ProfileRefreshIndicator': { useProfilePull: () => pull }, '@/features/profile/components/ProfileCover': { ProfileCover: 'Cover' },
    '@/features/auth/AuthProvider': { useAuth: () => ({ user, refreshUser: request }) }, '@/features/journeys/JourneyProvider': { useJourneys: () => ({ journeys, refresh: request, fetchOne: request, isLoading: false, error: null }) },
    '@/features/media/imageUrl': { resolveApiImageUrl: v => v, cachedImageSource: uri => ({ uri }) }, '@/features/navigation/TabBarScrollContext': { useTabBarController: () => ({ setCollapsed: noop }) },
    '@/features/navigation/geometry': { NAVIGATION_HEIGHT: 62, navigationBottom: inset => Math.max(inset - 12, 8) },
    '@/features/profile/components/ProfileJourneyGrid': { JourneyThumbnail: 'JourneyTile', journeyThumbnailSource: item => item.cover_media_url, usePublishedProfileJourneys: (_id, data) => data }, '@/features/moments/useProfileMoments': { useProfileMoments: () => ({ store, state: stored }) },
    '@/features/moments/api': { momentsApi: {} }, '@/features/profile/components/ProfileAvatarImage': { ProfileAvatarImage: 'Avatar' }, '@/features/profile/share': { shareProfile: noop }, '@/features/profile/theme': { useProfileTheme: () => theme },
  };
  h = harness('app/(tabs)/profile.tsx', mocks);
  const render = () => h.render(() => h.exports.default());
  const lists = tree => tree.props.children.filter(node => node?.type === 'ProfileGridList');
  const active = tree => lists(tree)[0];
  const findTabs = node => Array.isArray(node) ? node.map(findTabs).find(Boolean) : node?.type === 'Tabs' ? node : node?.props ? findTabs(node.props.children) : undefined;
  const select = (tree, tab) => findTabs(active(tree).props.ListHeaderComponent).props.onChange(tab);
  const style = flat => flat.props.style;
  return { render, lists, active, select, style, social, stored, user, timings, viewportSnapshots, normalize: style => profileAdapter({ style }, null).props.style,
    get requests() { return requests; }, get pageRequests() { return pageRequests; },
    setJourneys(next) { journeys = next; }, get journeys() { return journeys; },
    changeAccount(next) { user = next; journeys = []; stored.items = []; },
    refocus() { focusEffects.forEach(fn => fn()); },
  };
}
function countHeader(tree, predicate) {
  if (Array.isArray(tree)) return tree.reduce((n, child) => n + countHeader(child, predicate), 0);
  if (!tree || typeof tree !== 'object') return 0;
  return Number(predicate(tree)) + countHeader(tree.props?.children, predicate);
}
function assertSingleHeader(f, tree) {
  assert.equal(f.lists(tree).length, 1, 'exactly one scrolling owner');
  const header = f.active(tree).props.ListHeaderComponent;
  for (const label of ['Create a journey', 'Open settings']) assert.equal(countHeader(header, node => node.type === 'GlassButton' && node.props.label === label), 1, label);
  for (const label of ['View profile photo', 'Share profile']) assert.equal(countHeader(header, node => node.props?.accessibilityLabel === label), 1, label);
  for (const text of ['Travel User', 'Edit Profile', 'Share Profile', 'Journeys', 'Followers', 'Following']) assert.equal(countHeader(header, node => node.props?.children === text), 1, text);
  assert.equal(countHeader(header, node => node.type === 'Tabs'), 1);
  assert.equal(countHeader(header, node => Array.isArray(node.props?.children) && node.props.children.join('') === '@traveler'), 1);
  assert.equal(tree.props.children.filter(node => node?.type === 'AnimatedView' && node.props.children?.type === 'Cover').length, 1);
}
for (const dark of [false, true]) for (const count of [0, 1, 5, 20, 100, 200, 500]) test(`Profile has one shared header and only active data through 20 tab switches; dark=${dark}, posts=${count}`, () => {
  const f = profileFixture(dark, count);
  let tree = f.render(), flat = f.active(tree);
  assertSingleHeader(f, tree);
  const journeyData = flat.props.data, listKey = flat.key, renderCell = flat.props.renderItem;
  const geometry = JSON.stringify(flat.props.ListHeaderComponent.props.children.props.children.slice(0, 2).map(node => node.props.style));
  let momentData;
  for (let i = 0; i < 20; i++) {
    const selection = i % 2 ? 'journeys' : 'moments';
    f.select(tree, selection); tree = f.render(); flat = f.active(tree);
    assertSingleHeader(f, tree);
    assert.equal(flat.key, listKey); assert.equal(flat.props.renderItem, renderCell);
    assert.equal(flat.props.data.length, count); assert.equal(flat.props.numColumns, 3);
    assert.equal(flat.props.maxItemsInRecyclePool, 18);
    assert.equal(flat.props.contentContainerStyle.minHeight, undefined);
    assert.equal(flat.props.contentContainerStyle.paddingBottom, 84);
    assert.equal(f.style(flat).flex, 1);
    assert.equal(f.style(flat).position, undefined); assert.equal(f.style(flat).opacity, undefined);
    if (selection === 'journeys') { assert.equal(flat.props.data, journeyData); flat.props.onEndReached(); }
    else { momentData ??= flat.props.data; assert.equal(flat.props.data, momentData); }
    assert.equal(f.pageRequests, 0);
    assert.equal(JSON.stringify(flat.props.ListHeaderComponent.props.children.props.children.slice(0, 2).map(node => node.props.style)), geometry);
    if (count) {
      const cell = flat.props.data[0], rendered = flat.props.renderItem({ item: cell, index: 0 });
      const tile = selection === 'journeys' ? rendered.props.children : rendered;
      assert.equal(tile.type, selection === 'moments' ? 'MomentTile' : 'JourneyTile');
      assert.equal(flat.props.getItemType(cell), selection === 'moments' ? 'moment' : 'journey');
      assert.equal(tile.props.item ?? tile.props.journey, cell.value);
      assert.equal(flat.props.keyExtractor(cell), `${cell.kind}:${cell.value.id}`);
      if (selection === 'journeys') {
        const size = tile.props.size;
        assert.equal(rendered.props.style.height, size + 2);
        for (let index = 0; index < Math.min(3, count); index++) {
          const container = flat.props.CellRendererComponent({ index, style: { left: index * 390 / 3 } }, null);
          const left = container.props.style[0].left + container.props.style[1].transform[0].translateX;
          assert.ok(Math.abs(left - index * (size + 2)) < 1e-6);
        }
      } else { assert.equal(tile.props.embeddedWidth, 390); assert.equal(flat.props.CellRendererComponent, undefined); }
    }
  }
  assert.equal(f.requests, 0);
});
test('navigation returns, follow stats and Journey publish/edit/delete preserve the single header and unaffected records', () => {
  const f = profileFixture(false, 100);
  let tree = f.render();
  const initial = f.active(tree).props.data, untouched = initial[30].value, renderer = f.active(tree).props.renderItem;
  f.select(tree, 'moments'); tree = f.render(); const momentData = f.active(tree).props.data;
  for (const route of ['Settings', 'Journey Detail', 'Edit Profile', 'another tab']) {
    f.refocus(); tree = f.render(); assertSingleHeader(f, tree);
    assert.equal(f.active(tree).props.data, momentData, route); assert.equal(f.active(tree).props.renderItem, renderer);
  }
  f.social.stats = { followers_count: 6, following_count: 4 }; tree = f.render(); assertSingleHeader(f, tree);
  const added = { id: 'published', title: 'New trip', cover_media_url: 'https://media/new', media: [] };
  f.setJourneys([added, ...f.journeys]); tree = f.render(); assert.equal(f.active(tree).props.data, momentData);
  f.select(tree, 'journeys'); tree = f.render(); assertSingleHeader(f, tree);
  assert.equal(f.active(tree).props.data[0].value, added); assert.equal(f.active(tree).props.data[31].value, untouched);
  f.setJourneys(f.journeys.map(item => item.id === added.id ? { ...added, title: 'Edited' } : item)); tree = f.render(); assertSingleHeader(f, tree);
  assert.equal(f.active(tree).props.data[31].value, untouched);
  f.setJourneys(f.journeys.filter(item => item.id !== added.id)); tree = f.render(); assertSingleHeader(f, tree);
  assert.equal(f.active(tree).props.data[30].value, untouched);
  f.select(tree, 'moments'); tree = f.render(); assert.equal(f.active(tree).props.data, momentData);
  assert.equal(f.requests, 0);
});
test('Moments publication, loading and pagination retain pages and never mount another header', () => {
  const f = profileFixture(false, 5);
  let tree = f.render(); const journeyData = f.active(tree).props.data;
  f.select(tree, 'moments'); tree = f.render(); const original = f.active(tree).props.data[0].value;
  f.stored.loading = true; f.stored.loadingMore = true; tree = f.render(); assertSingleHeader(f, tree);
  assert.equal(f.active(tree).props.data[0].value, original); assert.ok(f.active(tree).props.ListFooterComponent);
  f.active(tree).props.onEndReached(); assert.equal(f.pageRequests, 1);
  f.stored.items = [{ id: 'new-moment', cover_url: 'https://media/new', place: { name: 'Paris' } }, ...f.stored.items, { id: 'next-page', cover_url: 'https://media/next', place: { name: 'Paris' } }];
  f.stored.loading = false; f.stored.loadingMore = false; tree = f.render(); assertSingleHeader(f, tree);
  assert.equal(f.active(tree).props.data.length, 7); assert.equal(f.active(tree).props.data[1].value, original);
  assert.equal(f.active(tree).props.ListFooterComponent, null);
  f.select(tree, 'journeys'); tree = f.render(); assertSingleHeader(f, tree); assert.equal(f.active(tree).props.data, journeyData);
});
test('account changes replace the single native root and immediately exclude previous account data', () => {
  const f = profileFixture(false, 5); let tree = f.render(); const oldKey = f.active(tree).key;
  f.select(tree, 'moments'); tree = f.render();
  f.changeAccount({ id: 'other', username: 'other' }); tree = f.render();
  assert.equal(tree.key, 'other'); assert.equal(f.lists(tree).length, 1);
  assert.equal(f.active(tree).props.data.length, 0); assert.notEqual(f.active(tree).key, oldKey);
});
test('cached Moments selection begins with one list and one header', () => {
  const f = profileFixture(false, 5, 'moments'); const tree = f.render(); assertSingleHeader(f, tree);
  assert.equal(f.active(tree).props.data[0].kind, 'moment'); assert.equal(f.requests, 0);
});
test('Profile normalizes the real Reanimated style-array output before FlashList spreads it', () => {
  const { PropsFilter } = harness('node_modules/react-native-reanimated/src/createAnimatedComponent/PropsFilter.tsx', {
    '../animation': {}, '../css/utils': {}, '../isSharedValue': { isSharedValue: () => false },
    '../WorkletEventHandler': { WorkletEventHandler: class {} }, './InlinePropManager': { hasInlineStyles: () => false },
    './utils': { flattenArray: value => Array.isArray(value) ? value.flat(Infinity) : [value], has: (name, value) => value != null && name in Object(value) },
  }).exports;
  const original = { flex: 1, position: 'absolute', top: 0, bottom: 0, opacity: 0 };
  const filtered = new PropsFilter().filterNonAnimatedProps({ props: { style: original }, _isFirstRender: true });
  assert.ok(Array.isArray(filtered.style));
  assert.equal({ ...filtered.style }.opacity, undefined, 'the old direct FlashList spread drops inactive opacity');
  const f = profileFixture(false, 5);
  assert.deepEqual(f.normalize(filtered.style), original);
  const tree = f.render(); const activeStyle = f.normalize([f.active(tree).props.style]);
  assert.equal(activeStyle.flex, 1); assert.equal(activeStyle.position, undefined);
});
test('buffer can reuse its previously displayed slot without waiting for a second native event', () => {
  const h = harness('src/features/media/components/StableCachedImage.tsx');
  const props = { uri: 'https://media/a', namespace: 'cover', style: {} };
  const render = () => h.render(() => h.exports.StableCachedImage(props));
  let tree = render(); images(tree)[0].props.onDisplay(); tree = render();
  props.uri = 'https://media/b'; tree = render(); images(tree)[1].props.onDisplay(); tree = render();
  assert.equal(opacity(images(tree)[1]), 1);
  props.uri = 'https://media/a'; tree = render();
  assert.equal(opacity(images(tree)[0]), 1); assert.equal(opacity(images(tree)[1]), 0);
  assert.equal(images(tree).length, 2, 'native slots remain bounded');
});

test('iOS decoded image cache has explicit cost and count eviction limits', () => {
  const configurations = [];
  harness('src/features/media/components/StableCachedImage.tsx', {
    'expo-image': { Image: { configureCache: options => configurations.push(options) } },
    'react-native': { Platform: { OS: 'ios' }, View: 'View', StyleSheet: { absoluteFill: {} } },
  });
  assert.equal(configurations.length, 1);
  assert.equal(configurations[0].maxMemoryCost, 64 * 1024 * 1024);
  assert.equal(configurations[0].maxMemoryCount, 256);
});


test('a recycled thumbnail remount uses a cached native reference as its first source', () => {
  const native = { width: 100, height: 100, scale: 1 };
  const h = harness('src/features/media/components/StableCachedImage.tsx', {
    '../decodedThumbnailCache': { decodedThumbnail: (scope, key, uri) => scope === 'owner' && uri === 'https://media/cover' ? native : undefined, retainDecodedThumbnail: async () => {} },
  });
  const tree = h.render(() => h.exports.StableCachedImage({ uri: 'https://media/cover', namespace: 'cover', cacheScope: 'owner', style: {} }));
  assert.equal(images(tree)[0].props.source, native);
  assert.equal(images(tree)[0].props.transition, 0);
});


test('real decoded cache bridges 20 thumbnail remounts and preserves replacement buffering', async () => {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/media/decodedThumbnailCache.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports });
  const cache = module.exports;
  const native = { width: 128, height: 128, scale: 3 };
  let reads = 0;
  const Image = { readFromCacheAsync: async () => { reads++; return native; } };
  const create = () => harness('src/features/media/components/StableCachedImage.tsx', {
    'expo-image': { Image }, '../decodedThumbnailCache': cache,
  });
  const props = { uri: 'https://media/cover?signature=old', namespace: 'cover', cacheScope: 'owner', style: {} };
  const first = create();
  const initial = first.render(() => first.exports.StableCachedImage(props));
  assert.equal(images(initial)[0].props.source.uri, props.uri);
  images(initial)[0].props.onDisplay();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 1);
  for (let i = 0; i < 20; i++) {
    const mount = create();
    const tree = mount.render(() => mount.exports.StableCachedImage(props));
    assert.equal(images(tree)[0].props.source, native);
    images(tree)[0].props.onDisplay();
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.equal(reads, 1, 'remounts reuse the existing native resource without another cache read');
  const mount = create();
  let tree = mount.render(() => mount.exports.StableCachedImage(props));
  images(tree)[0].props.onDisplay();
  const replacement = { ...props, uri: 'https://media/cover?signature=new' };
  tree = mount.render(() => mount.exports.StableCachedImage(replacement));
  assert.equal(images(tree)[0].props.source, native);
  assert.equal(opacity(images(tree)[0]), 1);
  assert.equal(images(tree)[1].props.source.uri, replacement.uri);
  assert.equal(opacity(images(tree)[1]), 0);
  images(tree)[1].props.onError({ error: 'expired' });
  tree = mount.render(() => mount.exports.StableCachedImage(replacement));
  assert.equal(images(tree)[0].props.source, native);
  assert.equal(opacity(images(tree)[0]), 1);
});


test('explicit retry restarts an unchanged failed URI and allows another failure notification', () => {
  const h = harness('src/features/media/components/StableCachedImage.tsx'); let failures = 0;
  const props = { uri: 'https://media/failed', namespace: 'cover', style: {}, onSourceError: () => failures++ };
  let tree = h.render(() => h.exports.StableCachedImage(props));
  const oldKey = images(tree)[0].key;
  images(tree)[0].props.onError({ error: 'timeout' });
  images(tree)[0].props.onError({ error: 'timeout' });
  assert.equal(failures, 1);
  tree = h.render(() => h.exports.StableCachedImage({ ...props, retryToken: 1 }));
  assert.notEqual(images(tree)[0].key, oldKey);
  assert.equal(images(tree)[0].props.source.uri, props.uri);
  images(tree)[0].props.onError({ error: 'timeout again' });
  assert.equal(failures, 2);
});

test('Journey retry is visible only after failure and does not navigate or alter other tiles', () => {
  const h = harness('src/features/profile/components/ProfileJourneyGrid.tsx', {
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    '@/features/media/components/StableCachedImage': { StableCachedImage: 'StableImage' },
    'expo-router': { useFocusEffect: () => {} }, '@/features/journeys/draftStorage': { listDrafts: () => [] },
    'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { absoluteFill: {}, create: x => x } },
  });
  let opened = 0, renewals = 0, stopped = 0;
  const props = { journey: { id: 'j', title: 'Trip', media: [], cover_media_url: 'url' }, size: 128, placeholder: '#eee', onOpen: () => opened++, onImageError: () => renewals++ };
  const render = () => h.render(() => h.exports.JourneyThumbnail(props));
  let tree = render(); assert.equal(tree.props.children[1], null);
  tree.props.children[0].props.onSourceError(); tree.props.children[0].props.onError();
  tree = render(); assert.equal(renewals, 1);
  assert.equal(tree.props.children[1].props.accessibilityLabel, 'Retry thumbnail for Trip');
  tree.props.children[1].props.onPress({ stopPropagation: () => stopped++ });
  tree = render(); assert.equal(tree.props.children[0].props.retryToken, 1);
  assert.equal(tree.props.children[1], null); assert.equal(opened, 0); assert.equal(stopped, 1);
});


for (const reduced of [false, true]) test(`Profile tab indicator respects Reduce Motion; enabled=${reduced}`, async () => {
  const f = profileFixture(false, 5, 'journeys', reduced);
  let tree = f.render(); await Promise.resolve(); tree = f.render();
  f.timings.length = 0;
  f.select(tree, 'moments'); tree = f.render();
  assertSingleHeader(f, tree);
  if (reduced) assert.equal(f.timings.length, 0);
  else { assert.equal(f.timings.length, 1); assert.equal(f.timings[0].duration, 200); }
});

test('returning to a mounted Profile reacquires an evicted Moment store and finishes a cold reload', async () => {
  const cache = harness('src/features/moments/gridCache.ts', {}).exports;
  let focused = true, requests = 0, h;
  const focus = new Map();
  const old = cache.momentGridFor('owner', { owner_id: 'owner' }, async () => ({ items: [{ id: 'warm' }], next_cursor: null }));
  await old.refresh();
  h = harness('src/features/moments/useProfileMoments.ts', {
    'expo-router': { useFocusEffect: fn => h.React.useEffect(() => {
      focus.set(fn, focused ? fn() : undefined);
      return () => { focus.get(fn)?.(); focus.delete(fn); };
    }, [fn]) },
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    './gridCache': cache,
    './api': { momentsApi: { page: async () => { requests++; return { items: [{ id: 'fresh' }], next_cursor: null }; } } },
  });
  const render = () => h.render(() => h.exports.useProfileMoments('owner', true));
  assert.equal(render().store, old); render(); assert.equal(requests, 0);
  focused = false; for (const cleanup of focus.values()) cleanup?.();
  for (let i = 0; i < 30; i++) cache.momentGridFor('owner', { owner_id: String(i) }, async () => ({ items: [], next_cursor: null }));
  assert.equal(old.isRetained(), false); assert.equal(old.getSnapshot().loaded, false);
  focused = true; for (const fn of [...focus.keys()]) focus.set(fn, fn());
  const returned = render(); assert.notEqual(returned.store, old);
  await returned.store.refresh();
  assert.equal(requests, 1); assert.equal(render().state.items[0].id, 'fresh');
  cache.clearMomentGridCache();
});

test('Profile counts every known unfinished Journey once, including drafts outside loaded pages', () => {
  const counts = [];
  const h = harness('src/features/profile/components/ProfileJourneyGrid.tsx', {
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, '@/features/media/components/StableCachedImage': {},
    'expo-router': { useFocusEffect: () => {} },
    '@/features/journeys/draftStorage': { listDrafts: () => [{ journeyId: 'loaded-draft' }, { journeyId: 'older-draft' }, { journeyId: 'older-draft' }] },
    'react-native': { StyleSheet: { create: value => value } },
  });
  const rows = [{ id: 'published' }, { id: 'loaded-draft' }];
  const result = h.render(() => h.exports.usePublishedProfileJourneys('owner', rows, count => counts.push(count)));
  assert.equal(result.length, 1); assert.equal(result[0].id, 'published'); assert.equal(counts.at(-1), 2);
});

test('the single Profile list records visible Journey assets and Moments never overwrite that return viewport', () => {
  const f = profileFixture(false, 5); let tree = f.render();
  const list = f.active(tree);
  list.props.onViewableItemsChanged({ viewableItems: [{ item: list.props.data[0], isViewable: true }] });
  assert.equal(f.viewportSnapshots.at(-1).owner, 'owner');
  assert.equal(f.viewportSnapshots.at(-1).items[0].namespace, 'journey.album.cover:journey-0');
  const captured = f.viewportSnapshots.length;
  f.select(tree, 'moments'); tree = f.render();
  const momentList = f.active(tree);
  momentList.props.onViewableItemsChanged({ viewableItems: [{ item: momentList.props.data[0], isViewable: true }] });
  assert.equal(f.viewportSnapshots.length, captured); assert.equal(f.lists(tree).length, 1);
  f.select(tree, 'journeys'); tree = f.render(); assert.equal(f.lists(tree).length, 1);
  assert.equal(f.requests, 0);
});

test('own Journey cells use native bounded thumbnails at physical grid resolution without altering web or cell geometry', () => {
  const h = harness('src/features/profile/components/ProfileJourneyGrid.tsx', {
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    '@/features/media/components/StableCachedImage': { StableCachedImage: 'StableImage' },
    'expo-router': { useFocusEffect: () => {} }, '@/features/journeys/draftStorage': { listDrafts: () => [] },
    'react-native': { Platform: { OS: 'ios' }, PixelRatio: { get: () => 3 }, StyleSheet: { create: x => x }, Pressable: 'Pressable' },
  });
  const props = { journey: { id: 'j', title: 'Trip', cover_media_url: 'https://media/original.jpg', media: [] }, size: 128, cacheScope: 'owner', placeholder: '#eee', onOpen: () => {} };
  const tree = h.render(() => h.exports.JourneyThumbnail(props));
  assert.equal(tree.props.children[0].type, 'JourneyImage'); assert.equal(tree.props.children[0].props.pixelSize, 384);
  assert.equal(tree.props.style.width, 128); assert.equal(tree.props.style.height, 128);
});
