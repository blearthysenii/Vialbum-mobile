const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  return module.exports;
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const api = load('src/features/stays/api.ts', { '@/api/client': {} });
function mount({ dark = false, own = false, manual = true, note = 'Personal tip', booking = 'airbnb', count = 2, error } = {}) {
  const routes = [], events = [];
  const tip = { id: 'recommendation', own, tip: note, booking_source: booking,
    creator: { id: 'creator', display_name: 'Bleart Hyseni', avatar_url: null },
    journey: { id: 'milan-journey', destination: 'Milan', month: '2026-09' } };
  const location = { name: 'Cologno Monzese', country: 'Italy', latitude: '45.528', longitude: '9.278' };
  const stay = { id: 'stay', name: 'Flat in Cologno Monzese with a long descriptive name', manual, location,
    place: manual ? null : { ...location }, accommodation_type: 'apartment', booking_source: booking,
    photos: Array.from({ length: count }, (_, i) => ({ id: `photo-${i}`, url: `signed-${i}`, position: i })), tips: [tip] };
  const { StayDetail } = load('src/features/stays/StayDetail.tsx', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-router': { router: { push: path => routes.push(path) } },
    'react-native': { View: 'View', Pressable: 'Pressable', ScrollView: 'Scroll', Text: 'Text', ActivityIndicator: 'Spinner', StyleSheet: { create: v => v, hairlineWidth: .5 } },
    'react-native-maps': { default: 'Map', Marker: 'Marker' },
    '@/features/posts/mediaShape': load('src/features/posts/mediaShape.ts', {}),
    '@/features/posts/data': { postTarget: id => `post:${id}` },
    '@/features/profile/components/ProfileAvatarImage': { ProfileAvatarImage: 'Avatar' },
    '@/theme/spacing': { spacing: { xxs: 4, xs: 6, sm: 10, md: 16, lg: 24, xl: 32, screen: 22 } },
    './api': api, './StayCard': { BookingChip: 'Booking', StayMetadata: 'Metadata', stayContext: () => 'Milan · Sep 2026' },
    './StayGallery': { StayGallery: 'Gallery' }, './StayGlass': { GlassButton: 'Glass' }, './StayUI': { Sheet: 'Sheet', Action: 'Action' },
  });
  const tree = StayDetail({ stay, theme: { dark, ink: dark ? '#fff' : '#111', muted: '#888', accent: '#2F95FF', divider: '#ddd' }, loading: false, error,
    onClose: () => events.push('close'), onRetry: () => events.push('retry'), onMore: () => events.push('more'), onMenu: selected => events.push(selected.id), onMap: point => events.push(point) });
  return { tree, events, routes };
}
for (const dark of [false, true]) for (const count of [1, 2, 3]) test(`detail uses existing sheet/gallery and safe preview: ${count} photos, dark=${dark}`, () => {
  const { tree, events, routes } = mount({ dark, count });
  assert.equal(tree.type, 'Sheet'); assert.equal(tree.props.title, 'Stay'); assert.equal(tree.props.closeLabel, 'Back');
  const gallery = nodes(tree, n => n.type === 'Gallery')[0];
  assert.equal(gallery.props.photos.length, count); assert.equal(gallery.props.postCorners, true); assert.equal(gallery.props.countInteractive, true); assert.equal(gallery.props.onMenu, undefined);
  const map = nodes(tree, n => n.props?.userInterfaceStyle)[0];
  assert.equal(map.props.scrollEnabled, false); assert.equal(map.props.pointerEvents, 'none');
  assert.equal(map.props.initialRegion.latitude, 45.528);
  assert.equal(map.props.userInterfaceStyle, dark ? 'dark' : 'light');
  nodes(tree, n => n.type === 'Glass' && n.props.label === 'View journey')[0].props.onPress();
  assert.equal(events[0], 'close'); assert.equal(routes[0], 'post:milan-journey');
  nodes(tree, n => n.type === 'Glass' && n.props.label === 'View on map')[0].props.onPress();
  assert.equal(events[events.length - 1].longitude, 9.278);
});
test('owner menu is available; provider stays do not show city-only privacy wording', () => {
  const { tree, events } = mount({ own: true, manual: false });
  nodes(tree, n => n.type === 'Gallery')[0].props.onMenu();
  assert.equal(events[0], 'recommendation');
  assert.equal(nodes(tree, n => n.props?.children === 'City location only · No private address shared').length, 0);
});
test('optional booking/note add no empty section; long note is fully readable and retry remains functional', () => {
  const empty = mount({ note: null, booking: null }).tree;
  assert.equal(nodes(empty, n => n.type === 'Booking').length, 0);
  assert.equal(nodes(empty, n => n.props?.children === 'Traveler recommendation').length, 0);
  const { tree, events } = mount({ note: 'A personal travel note. '.repeat(15), error: 'Failed refresh' });
  const quote = nodes(tree, n => Array.isArray(n.props?.children) && n.props.children[0] === '“')[0];
  assert.equal(quote.props.numberOfLines, undefined);
  assert.equal(nodes(tree, n => n.type === 'Scroll').length, 1);
  nodes(tree, n => n.type === 'Action' && n.props.label === 'Retry')[0].props.onPress();
  assert.equal(events[0], 'retry');
});

for (const dark of [false, true]) for (const own of [false, true]) test(`zero-photo detail has no hero and retains owner actions: dark=${dark}, own=${own}`, () => {
  const { tree, events } = mount({ count: 0, dark, own });
  assert.equal(nodes(tree, n => n.type === 'Gallery').length, 0);
  const menus = nodes(tree, n => n.props?.label === 'Stay options');
  assert.equal(menus.length, own ? 1 : 0);
  if (own) { menus[0].props.onPress(); assert.equal(events[0], 'recommendation'); }
  assert.equal(nodes(tree, n => n.type === 'Metadata').length, 1);
  assert.equal(nodes(tree, n => n.props?.label === 'View journey').length, 1);
});
