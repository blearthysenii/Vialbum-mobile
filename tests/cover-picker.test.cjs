const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function mount(count, onConfirm) {
  const state = []; let cursor = 0, cancelled = false;
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: {
      useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = next; }]; },
      useRef(initial) { const index = cursor++; return state[index] ??= { current: initial }; },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { StyleSheet: { create: value => value }, ...Object.fromEntries(['FlatList', 'Modal', 'Pressable', 'Text', 'View'].map(name => [name, name])) },
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-image': { Image: 'Image' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/features/media/imageUrl': { cachedImageSource: uri => uri },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/posts/CoverPicker.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, Error, require: require('./appearance-test-adapter.cjs').wrap(name => mocks[name]) });
  const photos = Array.from({ length: count }, (_, i) => ({ id: String(i), url: `photo-${i}` }));
  function render() { cursor = 0; return module.exports.CoverPicker({ photos, coverId: '0', onCancel: () => { cancelled = true; }, onConfirm }); }
  function nodes(tree, predicate) {
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
    return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
  }
  return {
    photo(i) { const grid = nodes(render(), node => node.type === 'FlatList')[0]; return grid.props.renderItem({ item: photos[i], index: i }).props; },
    button(label) { return nodes(render(), node => node.type === 'Pressable' && node.props.children?.props.children === label)[0].props; },
    error() { return nodes(render(), node => node.props?.accessibilityRole === 'alert')[0]?.props.children; },
    cancelled: () => cancelled,
  };
}

test('selection remains pending until Done; Cancel never saves; current cover is selected', async () => {
  const calls = []; const picker = mount(5, async id => calls.push(id));
  assert.equal(picker.photo(0).accessibilityState.selected, true);
  picker.photo(4).onPress();
  assert.equal(picker.photo(0).accessibilityState.selected, false);
  assert.equal(picker.photo(4).accessibilityState.selected, true);
  assert.deepEqual(calls, []);
  picker.button('Cancel').onPress(); assert.equal(picker.cancelled(), true); assert.deepEqual(calls, []);
  picker.button('Done').onPress(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['4']);
});

test('one photo is selectable and failed save retains the sheet with retry feedback', async () => {
  const picker = mount(1, async () => { throw new Error('Could not save'); });
  assert.equal(picker.photo(0).accessibilityState.selected, true);
  picker.button('Done').onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(picker.error(), 'Could not save');
  assert.equal(picker.cancelled(), false);
  assert.equal(picker.button('Done').disabled, false);
});
