const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}
function mount(props) {
  let cursor = 0;
  const slots = [], timings = [], resolved = [];
  const state = (initial) => { const i = cursor++; if (!(i in slots)) slots[i] = initial(); return [slots[i], value => { slots[i] = value; }]; };
  const mocks = {
    '@/features/profile/theme': { useProfileTheme: () => ({ heroColors: props.dark ? ['#171F2B', '#263B50', '#1C1C1E'] : ['#344C66', '#718A9F', '#E8E3D8'] }) },
    '@/features/media/components/StableCachedImage': { StableCachedImage: 'Image' },
    react: { memo: fn => fn, useCallback: fn => fn, useMemo: fn => fn(), useEffect: () => {}, useState: initial => state(() => initial) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { View: 'View', StyleSheet: { create: v => v, absoluteFill: { position: 'absolute' } } },
    'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated' }, Easing: { out: v => v, cubic: 'cubic' }, useAnimatedStyle: fn => fn(), useSharedValue: initial => state(() => ({ value: initial, set(v) { this.value = v; } }))[0], withTiming: (value, options) => { timings.push(options); return value; } },
    '@/features/media/imageUrl': { resolveApiImageUrl: value => { resolved.push(value); return value; }, cachedImageSource: (uri, key) => ({ uri, key }) },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/profile/components/ProfileCover.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, __DEV__: false, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  return { render: () => { cursor = 0; return module.exports.ProfileCover(props); }, timings, resolved };
}
for (const dark of [false, true]) for (const reduceMotion of [false, true]) test(`cover merges into actual canvas and preserves signed media: dark=${dark}, reduceMotion=${reduceMotion}`, () => {
  const canvas = dark ? '#000000' : '#FFFFFF';
  const cover = mount({ source: 'https://test/cover?signature=real', canvas, dark, reduceMotion }); const tree = cover.render();
  const fade = nodes(tree, 'Gradient').at(-1).props;
  assert.equal(fade.colors.at(-1), canvas); assert.equal(fade.colors[0], `${canvas}00`);
  assert.equal(Array.from(fade.locations).join(','), '0,0.48,0.62,0.77,0.91,1');
  const image = nodes(tree, 'Image')[0]; assert.equal(image.props.uri, 'https://test/cover?signature=real'); assert.equal(image.props.contentFit, 'cover'); assert.equal(image.props.namespace, 'profile-cover:https://test/cover');
  image.props.onLoad(); assert.equal(cover.timings[0].duration, reduceMotion ? 120 : 350);
  if (reduceMotion) assert.equal(nodes(tree, 'Animated')[0].props.style[1].transform[0].scale, 1);
  image.props.onError({}); assert.equal(nodes(cover.render(), 'Image').length, 0); assert.equal(nodes(cover.render(), 'Gradient').length, 3);
});
for (const dark of [false, true]) test(`missing cover retains color fallback and matching fade: dark=${dark}`, () => {
  const canvas = dark ? '#000000' : '#FFFFFF'; const cover = mount({ source: null, canvas, dark, reduceMotion: true });
  assert.equal(nodes(cover.render(), 'Image').length, 0); assert.equal(nodes(cover.render(), 'Gradient').at(-1).props.colors.at(-1), canvas);
});

test('removal and replacement never retain the previous cover image', () => {
  const props = { source: 'https://test/old', canvas: '#FFFFFF', dark: false, reduceMotion: true };
  const cover = mount(props);
  assert.equal(nodes(cover.render(), 'Image')[0].props.uri, props.source);
  props.source = null;
  assert.equal(nodes(cover.render(), 'Image').length, 0);
  props.source = 'https://test/new';
  assert.equal(nodes(cover.render(), 'Image')[0].props.uri, props.source);
  props.source = null;
  assert.equal(nodes(cover.render(), 'Image').length, 0);
});
