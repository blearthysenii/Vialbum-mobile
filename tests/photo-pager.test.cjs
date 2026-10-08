const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function mount(index = 1, mountPhoto = false, motion = {}) {
  const gestures = [], values = [], changes = [], springs = [], closes = [], haptics = [], reactions = [];
  const jsx = (type, props) => ({ type, props });
  const react = { useCallback: fn => fn, useMemo: fn => fn(), useEffect: fn => fn(), useRef: value => ({ current: value }) };
  const reanimated = { default: { View: 'AnimatedView' }, useSharedValue(value) {
    const shared = { get value() { return value; }, get: () => value, set: next => { value = next; } }; values.push(shared); return shared;
  }, useReducedMotion: () => false, useAnimatedReaction: (read, react) => reactions.push({ read, react }), useAnimatedStyle: fn => fn, runOnJS: fn => fn, withSpring: (value, config, done) => { springs.push({ value, config, done }); return value; }, withTiming: (value, _, done) => { done?.(true); return value; } };
  const gesture = () => { const callbacks = {}; const proxy = new Proxy({}, { get: (_, key) => (...args) => { if (key.startsWith('on')) callbacks[key] = args[0]; return proxy; } }); gestures.push(callbacks); return proxy; };
  const modules = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'expo-image': { Image: 'Image' }, 'react-native': { View: 'View', StyleSheet: { absoluteFill: {} } }, 'react-native-gesture-handler': { Gesture: { Pan: gesture, Pinch: gesture, Tap: gesture, Race: (...items) => items, Simultaneous: (...items) => items, Exclusive: (...items) => items }, GestureDetector: 'GestureDetector' }, 'react-native-reanimated': reanimated, '../imageUrl': { cachedImageSource: () => null }, 'expo-haptics': { ImpactFeedbackStyle: { Light: 'light' }, impactAsync: () => { haptics.push(true); return Promise.resolve(); } }, '../viewerGeometry': { heroGeometry: (frame, viewport, origin, progress) => ({ ...frame, x: 0, y: 0, imageScale: 1, radius: (origin?.radius ?? 0) * (1 - progress) }) } };
  const mod = { exports: {} };
  const source = fs.readFileSync('src/features/media/components/PhotoPager.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => modules[name] });
  const photos = [0, 1, 2].map(id => ({ id: String(id), url: `${id}.jpg`, width: 400, height: 800 }));
  const tree = mod.exports.PhotoPager({ photos, photo: photos[index], width: 400, height: 800, onChange: photo => changes.push(photo.id), onClose: () => closes.push(true), ...motion });
  let photoTree;
  if (mountPhoto) {
    const child = tree.props.children.props.children.props.children[index].props.children;
    photoTree = child.type(child.props);
  }
  return { drag: gestures[0], position: values[0], tree, changes, gestures, values, springs, closes, photoTree, haptics, reactions };
}

test('halfway drag displays adjacent photos together before selection changes', () => {
  const { drag, position, tree, changes } = mount();
  drag.onStart(); drag.onUpdate({ translationX: -200 });
  assert.equal(position.get(), -600);
  const pages = tree.props.children.props.children.props.children;
  assert.equal(pages[1].props.style.left + position.get(), -200);
  assert.equal(pages[2].props.style.left + position.get(), 200);
  assert.deepEqual(changes, []);
  drag.onEnd({ translationX: -200, velocityX: 0 });
  assert.equal(position.get(), -800); assert.deepEqual(changes, ['2']);
});
test('short drag snaps back and cancelled drag restores current position', () => {
  const { drag, position, changes } = mount();
  drag.onStart(); drag.onUpdate({ translationX: -40 });
  drag.onEnd({ translationX: -40, velocityX: 0 });
  assert.equal(position.get(), -400); assert.deepEqual(changes, ['1']);
  drag.onStart(); drag.onUpdate({ translationX: 100 }); drag.onFinalize({}, false);
  assert.equal(position.get(), -400);
});
test('first and last photos resist dragging beyond gallery boundaries', () => {
  for (const [index, translationX, target] of [[0, 200, 0], [2, -200, -800]]) {
    const { drag, position } = mount(index);
    drag.onStart(); drag.onUpdate({ translationX });
    assert.equal(position.get(), target + translationX * 0.2);
    drag.onEnd({ translationX, velocityX: translationX * 10 });
    assert.equal(position.get() + 0, target);
  }
});


test('downward pull tracks the finger, scales to 85%, and closes only after spring completion', () => {
  const { gestures, values, springs, closes, photoTree } = mount(1, true);
  const dismiss = gestures[5];
  dismiss.onUpdate({ translationX: 12, translationY: 300 });
  assert.equal(values[4].get(), 300);
  const style = photoTree.props.children.props.children.props.children.props.style[1]();
  assert.equal(style.borderRadius, 24);
  assert.equal(style.transform[0].translateX, 12);
  assert.equal(style.transform[1].translateY, 300);
  assert.equal(style.transform[2].scale, 0.85);
  dismiss.onEnd({ translationX: 12, translationY: 300, velocityX: 0, velocityY: 0 });
  assert.deepEqual(closes, []);
  springs.at(-1).done(true);
  assert.deepEqual(closes, [true]);
});

test('120px stays open; a shorter downward flick closes; upward velocity does not close', () => {
  for (const [distance, velocity, shouldClose] of [[120, 0, false], [121, 0, true], [35, 901, true], [35, -1000, false]]) {
    const { gestures, values, springs } = mount(1, true);
    gestures[5].onUpdate({ translationX: 0, translationY: distance });
    gestures[5].onEnd({ translationX: 0, translationY: distance, velocityX: 0, velocityY: velocity });
    assert.equal(springs.some(spring => Boolean(spring.done)), shouldClose);
    if (!shouldClose) assert.equal(values[4].get(), 0);
  }
});

test('cancelled dismissal restores the image and zoom blocks dismissal on the UI thread', () => {
  const { gestures, values } = mount(1, true);
  gestures[5].onUpdate({ translationX: 20, translationY: 80 });
  gestures[5].onFinalize({}, false);
  assert.equal(values[4].get(), 0);
  gestures[1].onStart();
  let failed = false;
  gestures[5].onTouchesDown({}, { fail: () => { failed = true; } });
  assert.equal(failed, true);
});


test('threshold feedback fires only once per drag, even when crossing back and forth', () => {
  const { gestures, haptics } = mount(1, true);
  const dismiss = gestures[5];
  dismiss.onStart();
  for (const translationY of [80, 121, 115, 140, 119, 130]) dismiss.onUpdate({ translationX: 0, translationY });
  assert.equal(haptics.length, 1);
  dismiss.onFinalize({}, false);
  dismiss.onStart(); dismiss.onUpdate({ translationX: 0, translationY: 121 });
  assert.equal(haptics.length, 2);
});
test('hero dismissal springs toward the source and calls close only after completion', () => {
  let progress = 1;
  const transition = { get: () => progress, set: value => { progress = value; } };
  const { gestures, springs, closes } = mount(1, true, { transition, origin: { x: 20, y: 100, width: 360, height: 450, radius: 22 } });
  gestures[5].onStart(); gestures[5].onUpdate({ translationX: 12, translationY: 140 });
  gestures[5].onEnd({ translationX: 12, translationY: 140, velocityX: 0, velocityY: 0 });
  assert.equal(springs.at(-1).value, 0);
  assert.deepEqual(closes, []);
  springs.at(-1).done(false); assert.deepEqual(closes, []);
  springs.at(-1).done(true); assert.deepEqual(closes, [true]);
});
test('double tap zooms toward the tap, locks carousel, and a second tap resets zoom', () => {
  const { gestures, values } = mount(1, true);
  gestures[3].onEnd({ x: 100, y: 200 }, true);
  assert.equal(values[1].get(), true);
  let failed = false;
  gestures[0].onTouchesDown({}, { fail: () => { failed = true; } });
  assert.equal(failed, true);
  // The stored translations point toward the tapped upper-left area.
  assert.equal(values[10].get(), 125);
  assert.equal(values[11].get(), 250);
  gestures[3].onEnd({ x: 100, y: 200 }, true);
  assert.equal(values[1].get(), false);
  assert.equal(values[10].get(), 0);
  assert.equal(values[11].get(), 0);
});
