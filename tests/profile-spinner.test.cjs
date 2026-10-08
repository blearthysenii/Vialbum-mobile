const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function loadGlyph() {
  const reactions = [], animations = [], repeats = [];
  let rotation;
  const mocks = {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { StyleSheet: { create: value => value } },
    'react-native-svg': { __esModule: true, default: 'Svg', Line: 'Line', G: 'G' },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated', createAnimatedComponent: v => v }, Easing: { linear: 'linear' }, useSharedValue: value => rotation = { value, set(next) { this.value = next; } }, useAnimatedStyle: fn => fn, useAnimatedProps: fn => fn, useAnimatedReaction: (read, react) => reactions.push({ read, react, previous: null }), cancelAnimation: () => {}, withTiming: (value, options) => { animations.push({ value, options }); return value; }, withRepeat: (value, count, reverse) => { repeats.push({ count, reverse }); return value; } },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/profile/ProfileSpinnerGlyph.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  const flush = () => reactions.forEach(r => { const next = r.read(); r.react(next, r.previous); r.previous = next; });
  return { ...module.exports, animations, repeats, flush, get rotation() { return rotation; } };
}
for (const reduced of [false, true]) test(`segmented native glyph forms progressively and retains rotation across armed/released states; reduced=${reduced}`, () => {
  const h = loadGlyph(), progress = { value: 0 }, phase = { value: h.RefreshPhase.PULLING };
  const glyph = h.ProfileSpinnerGlyph({ progress, phase, reduced }), svg = glyph.props.children;
  assert.equal(svg.props.width, 24); assert.equal(svg.props.height, 24); assert.equal(svg.props.children.length, 12);
  const lines = svg.props.children.map(child => child.type(child.props).props.children[1]);
  for (const line of lines) { assert.equal(line.props.stroke, '#48484A'); assert.equal(line.props.strokeWidth, 1.8); assert.equal(line.props.strokeLinecap, 'round'); }
  for (const amount of [0, .15, .3, .5, .75, 1]) {
    progress.value = amount; h.flush();
    const opacities = lines.map(line => line.props.animatedProps().strokeOpacity);
    assert.equal(opacities.filter(value => value > 0).length, Math.ceil(amount * 12));
    assert.equal(h.rotation.value, reduced ? 0 : amount * 240); assert.equal(h.repeats.length, 0);
  }
  const formed = lines.map(line => line.props.animatedProps().strokeOpacity);
  assert.equal(formed[0], .55); assert.equal(formed[11], 1);
  for (const child of svg.props.children) {
    const edge = child.type(child.props).props.children[0];
    assert.equal(edge.props.stroke, '#FFFFFF'); assert.equal(edge.props.strokeWidth, 2.8); assert.equal(edge.props.opacity, .45);
  }
  phase.value = h.RefreshPhase.ARMED; h.flush();
  assert.equal(h.animations[0].options.duration, 900); assert.equal(h.animations[0].options.easing, 'linear');
  assert.equal(h.repeats[0].count, -1); assert.equal(h.repeats[0].reverse, false);
  h.rotation.value = 527; // Current native animated angle during a held pull.
  phase.value = h.RefreshPhase.REFRESHING; h.flush();
  assert.equal(h.rotation.value, 527); assert.equal(h.repeats.length, 1);
  phase.value = h.RefreshPhase.COMPLETING; progress.value = .4; h.flush(); assert.equal(h.rotation.value, 527);
  assert.equal(glyph.props.style[0].backgroundColor, undefined);
});
test('indicator has no surface, border, shadow, arrow, text or per-pull React state', () => {
  const source = fs.readFileSync('src/features/profile/ProfileRefreshIndicator.tsx', 'utf8');
  assert.doesNotMatch(source, /backgroundColor|borderRadius|borderWidth|shadow|elevation|Ionicons|ActivityIndicator|<Text|useState/);
});
