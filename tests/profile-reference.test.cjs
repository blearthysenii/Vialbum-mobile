const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}
function initializer(path, name) {
  const ast = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let value;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) value = node.initializer.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); return value;
}
const chain = new Proxy(() => {}, { get: () => chain, apply: () => chain });
function header(dark, count) {
  const events = [];
  const context = { resolvePresentationColor: value => value, presentationTextStyle: value => value, draftCounts: { owner: 'owner', count: 0 }, userId: 'owner', totalCount: count, refreshCoverImage: () => {}, useMemo: fn => fn(), publishedJourneys: Array.from({ length: count }, () => ({})), require: require('./appearance-test-adapter.cjs').wrap(() => jsx), exports: {},
    View: 'View', Text: 'Text', Pressable: 'Pressable', Animated: { View: 'Animated', Text: 'Text' }, GlassButton: 'GlassButton', Ionicons: 'Icon', Photo: 'Photo', ProfileMediaTabs: 'Tabs',
    styles: new Proxy({}, { get: (_, key) => key }), theme: { ink: dark ? '#FFFFFF' : '#111111', muted: '#777777', canvas: dark ? '#000000' : '#FFFFFF' },
    name: 'A very long display name that wraps naturally', user: { id: 'owner', username: 'a_very_long_username_1234567890', profile_photo_url: null }, heroHeight: 300, insets: { top: 50 }, dark, reduceMotion: false,
    avatarEntrance: chain, actionsEntrance: chain, FadeIn: chain, FadeInDown: chain, Easing: chain, openCreate: () => events.push('create'), setShowAvatar: () => {},
    router: { push: route => events.push(route) }, journeys: Array.from({ length: count }, () => ({})), journeysLoading: false, social: { stats: { followers_count: 1200, following_count: 100000 }, loading: false },
    statDivider: '#DDDDDD', surface: '#F5F5F6', selectionHaptic: () => {}, setShareError: () => {}, shareProfile: username => events.push(['share', username]), dividerAnimatedStyle: {}, profileBorder: '#EEEEEE',
    refreshSocial: () => {}, journeyError: null, detailError: null, shareError: null, width: 390, pageProgress: { value: 1 }, collection: 'moments', albums: [{}, {}, {}], showAll: false, setShowAll: value => events.push(['all', value]), accent: '#0A84FF', setCollection: value => events.push(['collection', value]),
  };
  vm.runInNewContext(ts.transpileModule(`globalThis.tree = ${initializer('app/(tabs)/profile.tsx', 'header')}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  return { tree: context.tree, events };
}
for (const dark of [false, true]) for (const count of [0, 999]) test(`reference hierarchy and real actions: dark=${dark}, journeys=${count}`, async () => {
  const { tree, events } = header(dark, count);
  const texts = nodes(tree, 'Text').map(n => n.props.children);
  assert.ok(texts.indexOf('Journeys') < texts.indexOf('Edit Profile'));
  assert.ok(!texts.includes('Your travel'));
  assert.ok(!texts.includes('See all'));
  assert.ok(!texts.includes('Show less'));
  assert.ok(texts.includes('1.2K')); assert.ok(texts.includes('100K')); assert.ok(texts.includes(String(count)));
  const buttons = nodes(tree, 'Pressable');
  buttons.find(b => b.props.children?.props?.children === 'Edit Profile').props.onPress();
  buttons.find(b => b.props.accessibilityLabel === 'Share profile').props.onPress();
  for (const label of ['Journeys', 'Followers', 'Following']) buttons.find(b => b.props.accessibilityLabel?.startsWith(`${label},`)).props.onPress();
  await Promise.resolve(); await Promise.resolve();
  assert.ok(events.includes('/edit-profile'));
  assert.ok(events.some(e => Array.isArray(e) && e[0] === 'share'));
  assert.ok(events.some(e => e?.params?.kind === 'followers')); assert.ok(events.some(e => e?.params?.kind === 'following'));
  assert.ok(events.some(e => Array.isArray(e) && e[0] === 'collection' && e[1] === 'journeys'));
  assert.equal(nodes(tree, 'GlassButton').filter(n => n.props.label === 'Open settings').length, 1);
});
for (const dark of [false, true]) for (const reduced of [false, true]) for (const count of [2, 3]) test(`shared Post/Profile selector tap and drag: dark=${dark}, reduced=${reduced}, tabs=${count}`, () => {
  const animations = [], calls = [], values = [], handlers = {};
  const module = { exports: {} };
  const pan = new Proxy({}, { get: (_, name) => (...args) => { if (name.startsWith('on')) handlers[name] = args[0]; return pan; } });
  const mocks = { react: { useEffect: () => {}, useState: initial => [initial, () => {}] }, 'react/jsx-runtime': jsx,
    '@expo/vector-icons/Ionicons': { __esModule: true, default: 'Icon' },
    'react-native': { Pressable: 'Pressable', View: 'View', Text: 'Text', StyleSheet: { create: v => v, absoluteFill: {} } },
    'react-native-gesture-handler': { Gesture: { Pan: () => pan }, GestureDetector: 'Gesture', GestureHandlerRootView: 'GestureRoot' },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated' }, cancelAnimation: () => {}, runOnJS: fn => fn, useReducedMotion: () => reduced, useSharedValue: initial => { const value = { value: initial, get() { return this.value; }, set(v) { this.value = v; } }; values.push(value); return value; }, useAnimatedStyle: fn => fn(), withSpring: (value, config, complete) => { animations.push({ config, complete }); return value; } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/posts/PostTabs.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => mocks[name]) });
  const tabs = Array.from({ length: count }, (_, i) => ({ id: `tab${i}`, label: `Tab ${i}`, icon: 'map-outline' }));
  const tree = module.exports.SegmentedTabs({ tabs, active: tabs[0].id, onChange: v => calls.push(v), theme: { dark, placeholder: '#EEEEEE', canvas: '#FFFFFF', glassStrong: '#333333' }, initialWidth: 326, deferChangeUntilSettled: count === 2 });
  const buttons = nodes(tree, 'Pressable'); assert.equal(buttons.length, count);
  assert.equal(nodes(tree, 'Animated').length, 1);
  const indicator = nodes(tree, 'Animated')[0]; assert.equal(indicator.props.style[1].width, 320 / count);
  assert.equal(indicator.props.style[0].borderRadius, 22);
  buttons.at(-1).props.onPress();
  if (reduced || count === 3) assert.deepEqual(calls, [tabs.at(-1).id]);
  else { assert.deepEqual(calls, []); assert.equal(animations.at(-1).config.overshootClamping, true); animations.at(-1).complete(true); assert.deepEqual(calls, [tabs.at(-1).id]); }
  handlers.onStart(); handlers.onUpdate({ translationX: -10000 });
  assert.equal(values[0].get(), 0);
  handlers.onEnd({}, true);
  if (!reduced && count === 2) animations.at(-1).complete(true);
  assert.equal(calls.at(-1), tabs[0].id);
  handlers.onStart(); handlers.onUpdate({ translationX: 10000 });
  assert.equal(values[0].get(), 320 / count * (count - 1));
  handlers.onFinalize(); assert.equal(values[2].get(), false);
});
test('Profile keeps label positions and overlays a half-width indicator on one edge-to-edge baseline', () => {
  const module = { exports: {} }; const changes = [];
  const mocks = { 'react/jsx-runtime': jsx, react: { useState: v => [v, () => {}] },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated' }, useAnimatedStyle: fn => fn() },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: v => v } },
    '@expo/vector-icons/Ionicons': { __esModule: true, default: 'Icon' },
    '@/features/profile/theme': { useProfileTheme: () => ({ ink: '#FFFFFF', subtle: '#777777' }) } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/profile/components/ProfileMediaTabs.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => mocks[name]) });
  const tree = module.exports.ProfileMediaTabs({ selected: 'moments', initialWidth: 390, onChange: value => changes.push(value), contentMargin: 32, bottomSpacing: 0 });
  const tabs = nodes(tree, 'Pressable');
  assert.equal(tabs.length, 2);
  tabs.forEach(tab => { assert.equal(tab.props.style.width, '50%'); assert.equal(tab.props.style.borderRadius, undefined); });
  assert.equal(tabs[0].props.accessibilityState.selected, false);
  assert.equal(tabs[1].props.accessibilityState.selected, true);
  assert.equal(nodes(tabs[0], 'Icon')[0].props.name, 'map-outline');
  assert.equal(nodes(tabs[1], 'Icon')[0].props.name, 'play-circle-outline');
  assert.equal(nodes(tabs[1], 'Icon')[0].props.color, '#FFFFFF');
  const lines = nodes(tree, 'Animated').filter(node => Array.isArray(node.props.style) && node.props.style[0]?.height === 1);
  assert.equal(lines.length, 1); assert.equal(lines[0].props.style[0].left, 0); assert.equal(lines[0].props.style[1].width, '50%');
  assert.equal(tree.props.style.marginHorizontal, undefined);
  assert.equal(lines[0].props.style[2].transform[0].translateX, 195);
  const baseline = nodes(tree, 'View').find(node => node.props.style?.[0]?.right === 0);
  assert.ok(baseline); assert.equal(baseline.props.style[0].left, 0); assert.equal(baseline.props.style[0].bottom, 0);
  tabs[1].props.onPress(); assert.deepEqual(changes, ['moments']);
  assert.ok(!fs.readFileSync('app/(tabs)/profile.tsx', 'utf8').includes('contentDivider'));
});
test('photographic Journey cards use real cover, destination, relative date and existing callback', () => {
  const module = { exports: {} }; let opened = 0;
  const mocks = {
    'react/jsx-runtime': jsx, react: { useMemo: fn => fn(), useRef: () => ({}), useState: v => [v, () => {}] },
    '@expo/vector-icons/Ionicons': { __esModule: true, default: 'Icon' }, 'expo-blur': { BlurView: 'Blur' }, 'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'react-native': { ActivityIndicator: 'Loading', Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: v => v, hairlineWidth: 0.5, absoluteFill: {} } },
    'react-native-maps': { __esModule: true, default: 'Map', Marker: 'Marker' },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated' }, Easing: chain, FadeIn: chain, FadeOut: chain, useAnimatedStyle: fn => fn(), useSharedValue: value => ({ value }), withDelay: (_, v) => v, withSpring: v => v, withTiming: v => v },
    '@/features/media/imageUrl': { resolveApiImageUrl: v => v, cachedImageSource: v => ({ uri: v }) },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/profile/components/TravelProfileContent.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => mocks[name]) });
  const tree = module.exports.JourneyAlbumCard({ journey: { id: 'j', title: 'Real trip', destination: 'Istanbul', country: 'Turkey', cover_media_url: 'https://test/journey', media: [{ type: 'photo', url: 'https://test/other' }], created_at: new Date().toISOString() }, theme: { placeholder: '#EEEEEE' }, date: '', photographic: true, onPress: () => opened++ });
  const photoLayers = nodes(tree, 'View');
  assert.ok(nodes(tree, 'Text').some(n => n.props.children === 'Istanbul'));
  assert.ok(nodes(tree, 'Text').some(n => n.props.children === 'Today'));
  const image = nodes(tree, 'Pressable')[0].props.children[0];
  assert.equal(image.props.source, 'https://test/journey');
  assert.equal(image.type.name, 'AlbumLayer');
  nodes(tree, 'Pressable')[0].props.onPress(); assert.equal(opened, 1);
  assert.equal(module.exports.profileRelativeDate('2026-10-01T00:00:00Z', Date.parse('2026-10-04T00:00:00Z')), '3 days ago');
  assert.equal(module.exports.profileRelativeDate('invalid'), '');
});
