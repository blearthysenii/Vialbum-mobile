const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name]; }, ...globals });
  return module.exports;
}
const jsx = (type, props, key) => ({ type, props, key });
const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean).map(value => typeof value === 'function' ? value() : value));
function nodes(tree, match) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(node => nodes(node, match));
  return [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)];
}
function materialHarness({ platform = 'ios', available = true, api = true, missing = false } = {}) {
  const calls = [];
  const native = { StyleSheet: { create: v => v, absoluteFill: { position: 'absolute', inset: 0 }, hairlineWidth: .5 }, Platform: { OS: platform } };
  return { calls, module: load('src/features/navigation/NavigationGlass.tsx', {
    react: { memo: fn => fn, useEffect: () => {} }, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { ...native, View: 'View' },
    expo: { requireOptionalNativeModule: () => missing ? null : { isLiquidGlassAvailable: available, isGlassEffectAPIAvailable: api } },
    'expo-glass-effect': { get GlassView() { calls.push('native-manager-loaded'); return 'NativeGlass'; } },
    'expo-blur': { BlurView: 'Blur' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '@/theme/palette': { darkPalette: { surface: '#1A1B20', control: '#25262C' } },
  }) };
}
function navigationHarness({ dark = false, reduced = false, bottom = 34 } = {}) {
  const foreground = [];
  const slots = [], effects = new Map(), springs = [], events = [], navigations = [], gestures = [], rootKeys = ['home-key', 'moments-key', 'map-key', 'profile-key'];
  let cursor = 0, selected = 0, keyboard = false, locked = false, prevent = false;
  const routes = ['index', 'search', 'map', 'profile'].map((name, i) => ({ name, key: rootKeys[i], params: { preserved: i } }));
  const useState = value => { const index = cursor++; if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; };
  const useRef = value => { const index = cursor++; if (!(index in slots)) slots[index] = { current: value }; return slots[index]; };
  const effect = (fn, deps) => { const index = cursor++; const prior = effects.get(index); if (!prior || deps.some((value, i) => value !== prior.deps[i])) { prior?.release?.(); effects.set(index, { deps, release: fn() }); } };
  const react = { useState, useRef, useMemo: fn => fn(), useCallback: fn => fn, useEffect: effect, useLayoutEffect: effect };
  class Value { constructor(value) { this.value = value; } stopAnimation() {} setValue(v) { this.value = v; } interpolate(config) { return { animatedValue: this, ...config }; } }
  const animated = { Value, View: 'Animated', spring: (v, config) => ({ start() { v.value = config.toValue; } }), timing: (v, config) => ({ start() { v.value = config.toValue; } }) };
  const Gesture = { Pan: () => {
    const handlers = {}, g = { handlers };
    for (const name of ['enabled', 'activateAfterLongPress', 'activeOffsetX', 'failOffsetY', 'onBegin', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) g[name] = value => { handlers[name] = value; return g; };
    gestures.push(g); return g;
  } };
  const shared = value => useRef({ value, get() { return this.value; }, set(v) { this.value = v; } }).current;
  const light = { canvas: '#FFFFFF', activeIcon: '#171713', inactiveIcon: '#716F68' };
  const charcoal = { canvas: '#101114', activeIcon: '#F5F5F7', inactiveIcon: '#A1A1AA' };
  const material = { dark: true, activeIcon: '#FFFFFF', inactiveIcon: 'rgba(255,255,255,.72)' };
  const bar = load('app/(tabs)/_layout.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { AppState: { addEventListener: (_name, fn) => { foreground.push(fn); return { remove() {} }; } }, Animated: animated, Pressable: 'Pressable', View: 'View', StyleSheet: { create: v => v, absoluteFill: { position: 'absolute', inset: 0 }, hairlineWidth: .5 } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Reanimated', createAnimatedComponent: () => 'GesturePressable' }, runOnJS: fn => fn, useAnimatedStyle: fn => fn, useReducedMotion: () => reduced, useSharedValue: shared, withSpring: (v, options) => { springs.push([v, options]); return v; } },
    'react-native-gesture-handler': { Gesture, GestureDetector: 'Gesture', GestureHandlerRootView: 'Root' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom }) },
    'expo-router': { Tabs: Object.assign('Tabs', { Screen: 'Screen' }) }, 'expo-haptics': { selectionAsync: async () => {} },
    '@expo/vector-icons/Ionicons': { __esModule: true, default: 'Icon' },
    '@/theme/presentation': { usePresentationStyles: v => v, resolvePresentationColor: v => v },
    '@/features/navigation/NavigationGlass': { NavigationGlass: 'Glass', useNavigationEnvironment: () => ({ reduceTransparency: false, keyboardVisible: keyboard }) },
    '@/features/navigation/theme': { useNavigationTheme: () => ({ dark, ...(dark ? charcoal : light) }), momentsNavigationColors: material },
    '@/features/navigation/geometry': { NAVIGATION_HEIGHT: 62, navigationBottom: inset => Math.max(inset - 12, 8) },
    '@/features/navigation/TabBarScrollContext': { TabBarScrollProvider: 'Provider', useTabBarController: () => ({ collapsed: false, expand() {}, interactionLocked: locked, isInteractionLocked: () => locked }) },
  }, { setTimeout, clearTimeout, Date });
  const navigation = {
    emit(event) { events.push(event); return { defaultPrevented: prevent }; },
    navigate(name, params) { navigations.push([name, params]); selected = routes.findIndex(route => route.name === name); },
  };
  const render = () => {
    cursor = 0; const root = bar.default();
    const tabs = root.props.children.props.children;
    const element = tabs.props.tabBar({ state: { routes, index: selected }, descriptors: Object.fromEntries(routes.map(route => [route.key, { options: {} }])), navigation });
    return element.type(element.props);
  };
  const buttons = tree => nodes(tree, n => typeof n.type === 'function' && n.type.name === 'TabButton').map(node => node.type(node.props));
  const measure = (width = 390, rtl = false) => {
    let tree = render(); const slotWidth = (width - 40) / 4;
    for (const [i, button] of buttons(tree).entries()) button.props.onLayout({ nativeEvent: { layout: { x: (rtl ? 3 - i : i) * slotWidth, y: 0, width: slotWidth, height: 62 } } });
    return render();
  };
  return { render, measure, buttons, events, navigations, springs, routes,
    appState: value => foreground.forEach(fn => fn(value)),
    select: index => { selected = index; }, theme: value => { dark = value; }, keyboard: value => { keyboard = value; }, lock: value => { locked = value; }, prevent: value => { prevent = value; },
    gesture: () => gestures.at(-1), selection: tree => nodes(tree, n => n.type === 'Reanimated' && n.props.pointerEvents === 'none')[0],
  };
}
module.exports = { load, jsx, flatten, nodes, materialHarness, navigationHarness };
