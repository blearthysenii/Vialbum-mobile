const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function mount(reduced = false) {
  const slots = [], effects = [], completions = [], scrollStates = [];
  let cursor = 0, stateWrites = 0, haptics = 0, requests = 0, result;
  const slot = init => { const i = cursor++; if (!(i in slots)) slots[i] = init(); return i; };
  const mocks = {
    react: { useRef: value => slots[slot(() => ({ current: value }))], useCallback: (fn, deps) => { const i = slot(() => ({ fn, deps })); if (deps.some((value, j) => value !== slots[i].deps[j])) slots[i] = { fn, deps }; return slots[i].fn; }, useState: value => { const i = slot(() => value); return [slots[i], next => { slots[i] = next; stateWrites++; }]; }, useEffect: (fn, deps) => { const i = slot(() => null); if (!slots[i] || deps.some((v, j) => v !== slots[i][j])) effects.push(fn); slots[i] = deps; } },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    './ProfileSpinnerGlyph': { ProfileSpinnerGlyph: 'Glyph', RefreshPhase: { IDLE: 0, PULLING: 1, ARMED: 2, REFRESHING: 3, COMPLETING: 4 } },
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'react-native': { ActivityIndicator: 'Spinner', StyleSheet: { create: v => v } },
    'expo-haptics': { selectionAsync: async () => { haptics++; } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated' }, useReducedMotion: () => reduced, useDerivedValue: fn => ({ get value() { return fn(); } }), withSpring: value => value, useSharedValue: value => slots[slot(() => ({ value, set(next) { this.value = next; } }))], useAnimatedStyle: fn => fn, useAnimatedScrollHandler: handlers => handlers, runOnJS: fn => fn, cancelAnimation: () => { completions.length = 0; }, withTiming: (value, options, done) => { if (done) completions.push(done); return value; }, withDelay: (_, value) => value },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/profile/ProfileRefreshIndicator.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  const theme = { groupedSurface: 'surface', ink: 'ink', muted: 'muted' }, onScrollState = (...args) => scrollStates.push(args);
  const release = () => { requests++; };
  const render = (refreshing, resetKey = 'owner') => { cursor = 0; effects.length = 0; result = module.exports.useProfilePull({ resetKey, refreshing, reduced, topInset: 59, heroHeight: 324, theme, onScrollState, onReleaseRefresh: release }); effects.forEach(fn => fn()); return result; };
  const scroll = y => result.onScroll.onScroll({ contentOffset: { y }, contentSize: { height: 2000 }, layoutMeasurement: { height: 800 } });
  render(false);
  return { render, scroll, begin: () => result.onScroll.onBeginDrag(), end: () => result.onScroll.onEndDrag(), finish: () => { completions.splice(0).forEach(fn => fn(true)); }, scrollStates, get requests() { return requests; }, get phase() { return result.indicator.props.children.props.phase.value; }, native: () => result.requestRefresh(release), get haptics() { return haptics; }, get stateWrites() { return stateWrites; } };
}
for (const reduced of [false, true]) test(`pull animation is bounded, haptics once and React updates only at transitions; reduced=${reduced}`, () => {
  const h = mount(reduced); h.begin();
  for (let i = 1; i <= 200; i++) h.scroll(-i);
  assert.equal(h.stateWrites, 0); assert.equal(h.haptics, 1); assert.equal(h.scrollStates.length, 0);
  const result = h.render(false); assert.ok(result.indicator);
  const style = result.indicator.props.style.at(-1)(); assert.equal(style.opacity, 1); assert.equal(style.transform[0].translateY, 77);
  const hero = result.heroStyle();
  assert.equal(hero.height, undefined);
  const expansion = 324 * (reduced ? .06 : .32) * (1 - Math.exp(-200 / (324 * (reduced ? .06 : .32))));
  assert.equal(hero.transform[0].translateY, expansion / 2);
  assert.equal(hero.transform[1].scale, 1 + expansion / 324);
  h.end(); h.render(true); const loading = h.render(true); assert.equal(loading.indicator.props.children.type, 'Glyph'); assert.equal(loading.indicator.props.children.props.phase.value, 3);
  h.scroll(-120); h.scroll(0); assert.equal(h.haptics, 1);
  h.render(false); h.finish(); assert.equal(h.render(false).indicator.props.style.at(-1)().opacity, 0);
  h.begin(); h.scroll(-100); assert.equal(h.haptics, 2);
});
test('subthreshold release exits without refresh; ordinary scrolling bridges only navigation/status transitions', () => {
  const h = mount(); h.begin(); h.scroll(-25); assert.equal(h.haptics, 0); h.end(); h.finish(); assert.equal(h.render(false).indicator.props.style.at(-1)().opacity, 0);
  h.begin(); for (let i = 1; i <= 100; i++) h.scroll(i);
  assert.equal(h.scrollStates.length, 1); assert.equal(h.scrollStates[0][0], true);
  for (let i = 99; i >= 0; i--) h.scroll(i);
  assert.equal(h.scrollStates.length, 2); assert.equal(h.scrollStates[1][0], false);
});

test('single root hero remains anchored with bounded elastic scale at every pull and release offset', () => {
  const h = mount();
  for (const offset of [0, -1, -10, -30, -60, -100, -150, -300, -450, -2000, -80, -10, 0, 100]) {
    h.scroll(offset);
    const style = h.render(false).heroStyle();
    const pull = Math.max(0, -offset);
    const translate = style.transform[0].translateY;
    const expansion = 324 * (style.transform[1].scale - 1) / 2;
    assert.ok(Math.abs(translate - expansion + Math.max(0, offset)) < 1e-9);
    assert.ok(style.transform[1].scale >= 1 && style.transform[1].scale <= 1.32);
    if (pull > 0) assert.ok(translate + 324 + expansion >= 324);
    assert.equal(style.height, undefined);
    assert.equal(style.width, undefined);
  }
});

test('held armed gesture never fetches; release dispatches once even with native callbacks', () => {
  const h = mount(); h.begin(); h.scroll(-80);
  assert.equal(h.phase, 2); assert.equal(h.requests, 0);
  // Ten seconds of scroll updates at 60Hz, including early native activation.
  for (let frame = 0; frame < 600; frame++) { h.scroll(-100); h.native(); }
  assert.equal(h.requests, 0); assert.equal(h.haptics, 1); assert.equal(h.stateWrites, 0);
  h.end(); assert.equal(h.phase, 3); assert.equal(h.requests, 1);
  h.native(); h.native(); h.end(); assert.equal(h.requests, 1);
  h.render(true); h.render(false); assert.equal(h.phase, 4); h.finish(); assert.equal(h.phase, 0);
});
test('retreat disarms, recross does not spam haptics, and partial release rejects native activation', () => {
  const h = mount(); h.begin(); h.scroll(-85); h.scroll(-35); assert.equal(h.phase, 1);
  h.scroll(-85); assert.equal(h.phase, 2); assert.equal(h.haptics, 1);
  h.scroll(-35); h.native(); h.end(); h.native();
  assert.equal(h.requests, 0); assert.equal(h.phase, 4); h.finish(); assert.equal(h.phase, 0);
});

test('reselecting a retained list restores its scroll state without moving it; switching accounts resets it', () => {
  const h = mount(); h.scroll(500);
  const result = h.render(false);
  const before = result.heroStyle().transform[0].translateY;
  const transitions = h.scrollStates.length;
  result.syncScrollState();
  assert.equal(h.scrollStates.length, transitions + 1);
  assert.deepEqual(h.scrollStates.at(-1), [true, false]);
  assert.equal(result.heroStyle().transform[0].translateY, before);
  const nextAccount = h.render(false, 'other');
  assert.equal(nextAccount.heroStyle().transform[0].translateY, 0);
  nextAccount.syncScrollState();
  assert.deepEqual(h.scrollStates.at(-1), [false, true]);
  assert.equal(h.requests, 0);
});
