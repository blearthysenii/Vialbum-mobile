const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function load(os, reduced = false) {
  const module = { exports: {} }, animations = [], cleanup = [];
  let haptics = 0;
  const mocks = {
    'expo-blur': { BlurView: 'Blur' }, 'expo-haptics': { selectionAsync: async () => { haptics++; } },
    react: { useRef: value => ({ current: value }), useEffect: fn => cleanup.push(fn()) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native-reanimated': { useReducedMotion: () => reduced },
    'react-native': { Platform: { OS: os }, View: 'View', Pressable: 'Pressable', StyleSheet: { absoluteFill: { position: 'absolute' }, hairlineWidth: .5 }, Animated: {
      createAnimatedComponent: () => 'AnimatedPressable', Value: class { constructor(value) { this.value = value; } stopAnimation() {} },
      timing: (value, options) => ({ start: () => { animations.push(options); value.value = options.toValue; } }),
    } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/stays/StayGlass.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  return { ...module.exports, animations, cleanup, get haptics() { return haptics; } };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
for (const dark of [false, true]) test(`iOS glass uses real adaptive blur in ${dark ? 'Dark' : 'Light'} Mode; media stays legible`, () => {
  const glass = load('ios'), theme = { dark, glass: 'light', glassStrong: 'fallback', accent: '#2F95FF' };
  const normal = glass.GlassBackdrop({ theme, radius: 18 });
  assert.equal(nodes(normal, n => n.type === 'Blur')[0].props.tint, dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight');
  const media = glass.GlassBackdrop({ theme, radius: 18, media: true });
  assert.equal(nodes(media, n => n.type === 'Blur')[0].props.tint, 'systemThinMaterialDark');
  assert.equal(normal.props.pointerEvents, 'none');
});
test('non-iOS control uses readable themed fallback without requesting unsupported blur', () => {
  const glass = load('android');
  const surface = glass.GlassBackdrop({ theme: { dark: true, glassStrong: 'dark-material' }, radius: 18 });
  assert.equal(nodes(surface, n => n.type === 'Blur').length, 0);
  assert.equal(surface.props.style[1].backgroundColor, 'dark-material');
});
for (const reduced of [false, true]) test(`glass press triggers its action/haptic once; reduced motion=${reduced}`, async () => {
  const glass = load('ios', reduced); let actions = 0;
  const button = glass.GlassButton({ theme: { dark: false }, label: 'View map', onPress: () => actions++, children: 'content' });
  button.props.onPressIn(); button.props.onPressOut();
  assert.equal(actions, 0); assert.equal(glass.haptics, 0);
  button.props.onPress(); await Promise.resolve();
  assert.equal(actions, 1); assert.equal(glass.haptics, 1);
  assert.equal(glass.animations.length, reduced ? 0 : 2);
  glass.cleanup.forEach(fn => fn());
});

test('disabled glass control blocks action, haptics and press animation', () => {
  const glass = load('ios'); let calls = 0;
  const button = glass.GlassButton({ theme: {}, label: 'Review', disabled: true, onPress: () => calls++ });
  button.props.onPressIn(); button.props.onPress(); button.props.onPressOut();
  assert.equal(button.props.disabled, true); assert.equal(button.props.accessibilityState.disabled, true);
  assert.equal(calls, 0); assert.equal(glass.haptics, 0); assert.equal(glass.animations.length, 0);
});
