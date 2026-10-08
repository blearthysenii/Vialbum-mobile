const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { load, flatten, nodes, materialHarness, navigationHarness } = require('./helpers/navigation-harness.cjs');
for (const options of [{ available: false }, { api: false }, { missing: true }, { platform: 'android' }]) test(`unsupported native glass safely falls back: ${JSON.stringify(options)}`, () => {
  const h = materialHarness(options);
  const tree = h.module.NavigationGlass({ dark: true, radius: 31, reduceTransparency: false });
  assert.equal(h.calls.length, 0); assert.equal(nodes(tree, n => n.type === 'NativeGlass').length, 0);
  assert.equal(nodes(tree, n => n.type === 'Blur').length, options.platform === 'android' ? 0 : 1);
});
test('native glass stays the same component through Light, Dark and media appearance', () => {
  const h = materialHarness(); assert.equal(h.calls.length, 1);
  for (const dark of [false, true, false]) {
    const tree = h.module.NavigationGlass({ dark, radius: 31, reduceTransparency: false });
    assert.equal(tree.type, 'NativeGlass'); assert.equal(tree.props.colorScheme, dark ? 'dark' : 'light'); assert.equal(tree.props.glassEffectStyle, 'regular'); assert.equal(tree.key, undefined);
    const selected = h.module.NavigationGlass({ dark, selected: true, radius: 25, reduceTransparency: false });
    assert.equal(selected.props.glassEffectStyle, 'clear'); assert.equal(flatten(selected.props.style).borderRadius, 25);
  }
  assert.equal(h.calls.length, 1);
});
test('Reduce Transparency uses opaque, contrasting charcoal surfaces without blur or native effect', () => {
  const h = materialHarness();
  for (const selected of [false, true]) {
    const tree = h.module.NavigationGlass({ dark: true, selected, radius: 31, reduceTransparency: true });
    assert.equal(tree.type, 'View'); assert.equal(flatten(tree.props.style).backgroundColor, selected ? '#25262C' : '#1A1B20'); assert.equal(tree.props.pointerEvents, 'none');
  }
});
for (const width of [320, 375, 390, 430]) test(`measured selection fits every tab and both edges at iPhone width ${width}`, () => {
  const h = navigationHarness(); h.measure(width);
  for (let i = 0; i < 4; i++) {
    h.select(i); const tree = h.render(), style = flatten(h.selection(tree).props.style), slot = (width - 40) / 4;
    assert.equal(style.height, 50); assert.equal(style.width, slot - 12); assert.equal(style.borderRadius, 25);
    assert.equal(style.transform[0].translateX, i * slot + 6); assert.equal(style.transform[1].translateY, 6);
    assert.ok(style.transform[0].translateX + style.width <= width - 46);
  }
});
test('rapid taps navigate immediately, preserve route parameters, and synchronize the latest actual tab', () => {
  const h = navigationHarness(); h.measure();
  for (const index of [3, 1, 2, 0, 3, 0, 1]) {
    const before = h.render(); h.buttons(before)[index].props.onPress();
    assert.equal(h.navigations.at(-1)[0], h.routes[index].name); assert.equal(h.navigations.at(-1)[1], h.routes[index].params);
    const after = h.render(); assert.equal(flatten(h.selection(after).props.style).transform[0].translateX, index * 87.5 + 6);
    assert.equal(h.buttons(after).filter(button => button.props.accessibilityState.selected).length, 1);
  }
});
test('prevented tab presses and reselect preserve actual navigation state', () => {
  const h = navigationHarness(); h.measure(); h.prevent(true); h.buttons(h.render())[3].props.onPress();
  assert.equal(h.navigations.length, 0); assert.equal(flatten(h.selection(h.render()).props.style).transform[0].translateX, 6);
  h.prevent(false); const tree = h.render(); nodes(tree, n => n.type === 'GesturePressable')[0].props.onPress();
  assert.equal(h.events.at(-1).type, 'tabPress'); assert.equal(h.events.at(-1).target, 'home-key'); assert.equal(h.navigations.length, 0);
  nodes(tree, n => n.type === 'GesturePressable')[0].props.onLongPress();
  assert.equal(h.events.at(-1).type, 'tabLongPress');
});
test('localized indicator dragging settles back when navigation is locked or prevented; RTL slots stay in bounds', () => {
  const h = navigationHarness(); h.measure(390, true); const gesture = h.gesture().handlers;
  gesture.onBegin(); gesture.onStart(); gesture.onUpdate({ translationX: -200 }); h.lock(true); gesture.onEnd({ velocityX: 0 });
  assert.equal(h.navigations.length, 0); assert.equal(flatten(h.selection(h.render()).props.style).transform[0].translateX, 268.5);
});
test('theme, keyboard and accessibility updates retain route keys and selection without navigating', () => {
  const h = navigationHarness(); h.measure(); h.select(3);
  for (const dark of [true, false, true]) {
    h.theme(dark); const tree = h.render(); assert.equal(nodes(tree, n => n.type === 'Glass')[0].props.dark, dark);
    assert.equal(flatten(h.selection(tree).props.style).transform[0].translateX, 268.5);
    assert.deepEqual(h.buttons(tree).map(button => button.props.accessibilityRole), ['tab', 'tab', 'tab', 'tab']);
  }
  h.keyboard(true); const hidden = h.render(); assert.equal(flatten(hidden.props.style).display, 'none'); assert.equal(hidden.props.pointerEvents, 'none');
  assert.ok(h.buttons(hidden).every(button => button.props.disabled));
  h.keyboard(false); assert.equal(flatten(h.render().props.style).display, 'flex'); assert.equal(h.navigations.length, 0);
});
test('Reduce Motion eliminates selection springs', () => {
  const h = navigationHarness({ reduced: true }); h.measure(); h.select(3); h.render(); h.buttons(h.render())[1].props.onPress(); h.render(); assert.equal(h.springs.length, 0);
});
test('accessibility/keyboard listeners refresh on foreground and release on unmount', async () => {
  const listeners = new Map(), state = [], cleanup = [];
  let visible = false, removed = 0;
  const add = (name, fn) => { listeners.set(name, fn); return { remove: () => removed++ }; };
  const h = load('src/features/navigation/NavigationGlass.tsx', {
    react: { memo: fn => fn, useState: value => { const index = state.length; state.push(value); return [value, next => { state[index] = next; }]; }, useEffect: fn => cleanup.push(fn()) },
    'react/jsx-runtime': {}, 'react-native': { Platform: { OS: 'ios' }, View: 'View', StyleSheet: { create: v => v }, AccessibilityInfo: { isReduceTransparencyEnabled: async () => false, addEventListener: add }, Keyboard: { isVisible: () => visible, addListener: add }, AppState: { addEventListener: add } },
    expo: { requireOptionalNativeModule: () => null }, 'expo-blur': {}, 'expo-linear-gradient': {}, '@/theme/palette': {},
  });
  h.useNavigationEnvironment(); await Promise.resolve(); assert.deepEqual(state, [false, false]);
  listeners.get('keyboardWillShow')(); assert.equal(state[1], true); listeners.get('keyboardDidHide')(); assert.equal(state[1], false);
  listeners.get('reduceTransparencyChanged')(true); assert.equal(state[0], true);
  visible = true; listeners.get('change')('active'); await Promise.resolve(); assert.deepEqual(state, [false, true]);
  cleanup.forEach(fn => fn()); assert.equal(removed, 4);
});
test('nested/modals and Profile image/data/lifecycle files remain exactly unchanged by navigation work', () => {
  const baseline = require('./fixtures/navigation-protected.json');
  for (const [file, digest] of Object.entries(baseline)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), digest, file);
  const source = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');
  assert.doesNotMatch(source, /useNativeDriver: false|key=\{(?:theme|dark)|unmountOnBlur/);
  assert.match(source, /sceneStyle: \{ backgroundColor: theme.canvas \}/);
});

test('backgrounding clears pressed material feedback while retaining the active tab', () => {
  const h = navigationHarness(); h.measure(); h.select(3); const tree = h.render();
  tree.props.onTouchStart();
  const feedback = nodes(tree, n => n.type === 'Animated' && n.props.pointerEvents === 'none')[0];
  const progress = flatten(feedback.props.style).transform[0].scaleX.animatedValue;
  assert.equal(progress.value, 1); h.appState('background'); assert.equal(progress.value, 0);
  h.appState('active'); assert.equal(h.buttons(h.render())[3].props.accessibilityState.selected, true); assert.equal(h.navigations.length, 0);
});
