const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, Date, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  return module.exports;
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function assertNoRawText(tree, parentType) {
  if (Array.isArray(tree)) { tree.forEach(child => assertNoRawText(child, parentType)); return; }
  if (typeof tree === 'string' || typeof tree === 'number') { assert.equal(parentType, 'Text', `Raw text ${JSON.stringify(tree)} inside ${String(parentType)}`); return; }
  if (tree && typeof tree === 'object') assertNoRawText(tree.props?.children, tree.type);
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const rn = { View: 'View', Pressable: 'Pressable', Text: 'Text', ActivityIndicator: 'Spinner', StyleSheet: { create: value => value, hairlineWidth: .5 } };
const theme = dark => ({ dark, canvas: dark ? '#000' : '#fff', glass: 'surface', glassStrong: 'material', muted: 'secondary', ink: 'primary', divider: 'border', accent: 'accent', placeholder: 'placeholder' });
for (const dark of [false, true]) for (const count of [0, 1, 2, 3]) test(`${count}-photo collage opens selected real frame in ${dark ? 'Dark' : 'Light'} Mode`, () => {
  let cursor = 0; const slots = [];
  const react = { useMemo: fn => fn(), useState: value => { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; }]; } };
  const { StayGallery } = load('src/features/stays/StayGallery.tsx', { react, 'react/jsx-runtime': jsx,
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-image': { Image: 'Image' }, '@/features/posts/mediaShape': load('src/features/posts/mediaShape.ts', {}), './StayGlass': { GlassBackdrop: 'GlassBackdrop', GlassButton: 'GlassButton' }, 'expo-blur': { BlurView: 'Blur' }, 'expo-haptics': { selectionAsync: async () => {} }, 'react-native': { ...rn, Platform: { OS: 'ios' } },
    'react-native-reanimated': { useReducedMotion: () => true },
    '@/features/discover/components/PublicPhotoViewer': { PublicPhotoViewer: 'Viewer' },
    '@/features/media/imageUrl': { cachedImageSource: (uri, namespace) => ({ uri, cacheKey: namespace }) },
  });
  const photos = Array.from({ length: count }, (_, i) => ({ id: `real-${i}`, url: `https://signed.test/${i}`, position: i }));
  const render = () => { cursor = 0; return StayGallery({ photos, theme: theme(dark), onRetry() {} }); };
  let tree = render();
  assertNoRawText(tree);
  const tiles = nodes(tree, n => typeof n.type === 'function' && n.type.name === 'Photo');
  assert.equal(tiles.length, count);
  if (!count) { assert.equal(tree, null); return; }
  const viewer = nodes(tree, n => n.type === 'Viewer')[0];
  assert.equal(viewer.props.photos.length, count);
  assert.ok(viewer.props.photos.every(photo => photo.place === null && photo.latitude === null && photo.longitude === null));
  if (!count) assert.ok(nodes(tree, n => n.props?.name === 'bed-outline').length);
  for (let i = 0; i < count; i++) {
    tiles[i].props.onPress(); tree = render();
    assertNoRawText(tree);
    assert.equal(nodes(tree, n => n.type === 'Viewer')[0].props.photo.id, `real-${i}`);
  }
  if (count) {
    cursor = 0;
    const detail = StayGallery({ photos, theme: theme(dark), postCorners: true, countInteractive: true, onRetry() {} });
    assertNoRawText(detail);
    nodes(detail, n => n.props?.label === `Open ${count} stay photos`)[0].props.onPress();
    assert.equal(nodes(render(), n => n.type === 'Viewer')[0].props.photo.id, 'real-0');
  }
});
test('card context uses destination and actual month; missing fields add no invented claims', () => {
  const routes = [];
  const { stayContext, BookingChip, RecommendationText, StayCard } = load('src/features/stays/StayCard.tsx', {
    react: { useState: initial => [initial, () => {}] }, 'react/jsx-runtime': jsx, 'react-native': rn,
    'react-native-reanimated': { useReducedMotion: () => true }, '@expo/vector-icons/Ionicons': { default: 'Icon' },
    'expo-router': { router: { push: path => routes.push(path) } },
    'expo-haptics': { selectionAsync: async () => {} }, '@/features/posts/mediaShape': load('src/features/posts/mediaShape.ts', {}), '@/theme/spacing': { spacing: { xxs: 4, xs: 6, sm: 10, md: 16, lg: 24, screen: 22 } },
    '@/features/profile/components/ProfileAvatarImage': { ProfileAvatarImage: 'Avatar' },
    '@/features/posts/data': { postTarget: id => id }, './StayGallery': { StayGallery: 'Gallery' }, './StayGlass': { GlassButton: 'GlassButton' },
    './api': { accommodationTypes: { apartment: 'Apartment' }, bookedVia: value => value ? `Booked via ${value}` : null, stayCategory: () => 'Stay' },
  });
  assert.equal(stayContext({ journey: { destination: 'Milan', title: 'Lake Como, Milan', month: '2026-09' } }), 'Milan · Sep 2026');
  assert.equal(BookingChip({ source: null, theme: theme(false) }), null);
  assert.equal(RecommendationText({ text: null, theme: theme(false) }), null);
  let opened = 0, mapped = 0;
  const card = StayCard({ stay: { name: 'A very long accommodation name in a very long destination', city: 'City', tips: [], photos: [], manual: true, place: null }, theme: theme(true), onOpen: () => opened++, onMap: () => mapped++, onRetry() {} });
  nodes(card, n => n.props?.accessibilityLabel?.startsWith('View A very') && !n.props.accessibilityLabel.endsWith('on map'))[0].props.onPress();
  nodes(card, n => n.props?.label?.endsWith('on map'))[0].props.onPress();
  assert.equal(opened, 1); assert.equal(mapped, 1);
  assert.equal(nodes(card, n => n.type === 'Gallery').length, 0);
  for (const dark of [false, true]) for (const own of [false, true]) for (const count of [0, 1, 2, 3]) {
    let menu = 0;
    const variant = StayCard({ stay: { name: 'Stay', photos: Array.from({ length: count }, () => ({ url: 'real-photo' })), tips: [] }, theme: theme(dark), onOpen() {}, onRetry() {}, onMenu: own ? () => menu++ : undefined });
    const galleries = nodes(variant, n => n.type === 'Gallery');
    assert.equal(galleries.length, count ? 1 : 0);
    const menus = nodes(variant, n => n.props?.label === 'Stay options');
    assert.equal(menus.length, !count && own ? 1 : 0);
    if (!count && own) { menus[0].props.onPress(); assert.equal(menu, 1); }
  }
});
