const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, modules = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: require('./appearance-test-adapter.cjs').wrap(name => modules[name]) });
  return mod.exports;
}
test('routed selection targets only the originating carousel and ignores disposed sessions', () => {
  const { createViewerSelectionSession, updateViewerSelection } = load('src/features/media/viewerSelection.ts');
  const first = [], second = [];
  const a = createViewerSelectionSession(id => first.push(id));
  const b = createViewerSelectionSession(id => second.push(id));
  updateViewerSelection(a.id, 'photo-5');
  assert.deepEqual(first, ['photo-5']);
  assert.deepEqual(second, []);
  a.dispose();
  updateViewerSelection(a.id, 'photo-1');
  updateViewerSelection(undefined, 'photo-1');
  updateViewerSelection(b.id, 'photo-3');
  assert.deepEqual(first, ['photo-5']);
  assert.deepEqual(second, ['photo-3']);
});
test('public viewer shares selection before every close path and reopens at that photo without remounting on selection', () => {
  const jsx = (type, props, key) => ({ type, props, key });
  const modules = {
    react: { useState: value => [value, () => {}], useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native-reanimated': { default: { View: 'AnimatedView' }, useSharedValue: value => ({ get: () => value, set: next => { value = typeof next === "function" ? next(value) : next; } }), useAnimatedStyle: fn => fn },
    'expo-blur': { BlurView: 'BlurView' }, '@/features/media/useViewerChrome': { useViewerChrome: () => ({ visible: true, opacity: { get: () => 1 }, reveal: () => {}, interaction: () => {} }) }, '@/features/media/components/ViewerCaption': { ViewerCaption: 'ViewerCaption' }, '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native': { Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: x => x, absoluteFill: {} }, useWindowDimensions: () => ({ width: 400, height: 800 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    'react-native-gesture-handler': { GestureHandlerRootView: 'Root' },
    '@/features/media/components/PhotoPager': { PhotoPager: 'PhotoPager' },
  };
  const { PublicPhotoViewer } = load('src/features/discover/components/PublicPhotoViewer.tsx', modules);
  const photos = Array.from({ length: 5 }, (_, i) => ({ id: `photo-${i + 1}` }));
  let current = photos[0], carouselIndex = 0;
  const closed = [];
  const props = () => ({ photos, photo: current, onPhotoChange: next => { current = next; carouselIndex = photos.indexOf(next); }, onClose: () => closed.push(carouselIndex) });
  const modal = PublicPhotoViewer(props());
  const gallery = modal.props.children.type(modal.props.children.props);
  const pager = gallery.props.children[2];
  pager.props.onChange(photos[4]);
  assert.equal(carouselIndex, 4); // Already correct before the backdrop is pulled away.
  const updated = PublicPhotoViewer(props());
  assert.equal(updated.props.children.key, modal.props.children.key);
  pager.props.onClose(); // Completed pull-down animation.
  gallery.props.children[3].props.children[0].props.onPress(); // X requests the same animation.
  assert.equal(pager.props.closeRequest.get(), 1);
  modal.props.onRequestClose(); // System back uses the registered animation too.
  assert.equal(pager.props.closeRequest.get(), 2);
  assert.deepEqual(closed, [4]);
  const reopened = PublicPhotoViewer(props());
  const reopenedGallery = reopened.props.children.type(reopened.props.children.props);
  assert.equal(reopenedGallery.props.children[2].props.photo.id, 'photo-5');
});
