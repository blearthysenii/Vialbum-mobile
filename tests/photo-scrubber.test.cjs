const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function mount(count = 18, index = 0, reduced = false) {
  const handlers = {}, options = {}, values = [], changes = [];
  const tapHandlers = {};
  const tap = new Proxy({}, { get: (_, key) => (...args) => {
    if (key.startsWith('on')) tapHandlers[key] = args[0];
    return tap;
  } });
  const pan = new Proxy({}, { get: (_, key) => (...args) => {
    if (key.startsWith('on')) handlers[key] = args[0]; else options[key] = args;
    return pan;
  } });
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: { useEffect: fn => fn(), useState: () => [200, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', StyleSheet: { create: x => x } },
    'react-native-gesture-handler': { Gesture: { Pan: () => pan, Tap: () => tap, Exclusive: (...gestures) => gestures }, GestureDetector: 'Detector', GestureHandlerRootView: 'Root' },
    'react-native-reanimated': {
      default: { View: 'AnimatedView' }, runOnJS: fn => fn, useAnimatedStyle: fn => fn(),
      useReducedMotion: () => reduced, withTiming: value => value,
      LinearTransition: { duration: () => ({}) },
      useSharedValue: value => { const shared = { get: () => value, set: next => { value = next; } }; values.push(shared); return shared; },
    },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/features/posts/PhotoScrubber.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    assert.ok(mocks[name], `Unexpected dependency: ${name}`); return mocks[name];
  } });
  const tree = module.exports.PhotoScrubber({ count, index, theme: {}, onSelect: next => changes.push(next) });
  return { tree, handlers, tapHandlers, options, values, changes, paginationWindow: module.exports.paginationWindow };
}

test('window follows real photo indices forward and backward with continuation edges', () => {
  const { paginationWindow } = mount();
  for (const [photo, first, last] of [[1, 1, 7], [4, 1, 7], [8, 5, 11], [15, 12, 18], [20, 14, 20], [8, 5, 11], [1, 1, 7]]) {
    const dots = paginationWindow(20, photo - 1);
    assert.equal(dots.length, 7);
    assert.equal(dots[0].photoIndex, first - 1);
    assert.equal(dots.at(-1).photoIndex, last - 1);
    assert.equal(dots[0].continuation, first > 1);
    assert.equal(dots.at(-1).continuation, last < 20);
  }
  for (let count = 2; count <= 7; count++) {
    assert.deepEqual(Array.from(paginationWindow(count, count - 1), dot => dot.photoIndex), Array.from({ length: count }, (_, i) => i));
  }
});
test('tap opens the real visible photo, not a compressed album position', () => {
  const s = mount(20, 14);
  s.tapHandlers.onEnd({ x: 58 }, true); // first slot: photo 12
  s.tapHandlers.onEnd({ x: 142 }, true); // last slot: photo 18
  s.tapHandlers.onEnd({ x: 0 }, true); // blank area
  s.tapHandlers.onEnd({ x: 58 }, false);
  assert.deepEqual(s.changes, [11, 17]);
});

test('requires a hold and horizontal movement; no change from holding alone', () => {
  const s = mount();
  assert.equal(s.options.activateAfterLongPress[0], 220);
  assert.deepEqual(Array.from(s.options.failOffsetY[0]), [-10, 10]);
  s.handlers.onStart(); s.handlers.onFinalize();
  assert.deepEqual(s.changes, []);
});
test('scrubs every photo in both directions, clamps and skips repeated indices', () => {
  const s = mount(); s.handlers.onStart();
  for (let i = 0; i < 18; i++) s.handlers.onUpdate({ x: i / 17 * 200 });
  assert.deepEqual(s.changes, Array.from({ length: 17 }, (_, i) => i + 1));
  s.handlers.onUpdate({ x: 900 }); assert.equal(s.changes.length, 17);
  s.handlers.onUpdate({ x: -900 }); assert.equal(s.changes.at(-1), 0);
  s.handlers.onUpdate({ x: 200 }); s.handlers.onFinalize();
  assert.equal(s.values[0].get(), 17); assert.equal(s.values[2].get(), 1);
});
test('one photo hides controls, two photos work, Reduce Motion disables scaling', () => {
  assert.equal(mount(1).tree, null);
  const s = mount(2, 0, true); s.handlers.onStart();
  assert.equal(s.values[2].get(), 1);
  s.handlers.onUpdate({ x: 200 }); assert.deepEqual(s.changes, [1]);
});
test('accessibility reports the photo and supports adjustment', () => {
  const s = mount(18, 8);
  const props = s.tree.props.children.props.children.props;
  assert.equal(props.accessibilityValue.text, 'Photo 9 of 18');
  props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
  props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
  assert.deepEqual(s.changes, [9, 7]);
});
test('carousel uses exact offsets and post route resets content by identity', () => {
  const content = fs.readFileSync('src/features/posts/PostContent.tsx', 'utf8');
  assert.match(content, /scrollToOffset\(\{ offset: next \* width, animated: false \}\)/);
  assert.match(content, /getItemLayout=/);
  assert.match(content, /if \(next === activeRef.current\) return/);
  assert.match(content, /Haptics.selectionAsync/);
  const screen = fs.readFileSync('src/features/posts/PostDetailScreen.tsx', 'utf8');
  assert.match(screen, /PostContent key=\{`\$\{journey.id\}:\$\{memoryId/);
});
