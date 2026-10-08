const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
test('photo editor follows live theme changes while retaining captions, active photo, order and cover', () => {
  const jsx = (type, props) => ({ type, props });
  let dark = false;
  const native = { StyleSheet: { create: v => v, hairlineWidth: 1 }, useWindowDimensions: () => ({ height: 844 }), useColorScheme: () => dark ? 'dark' : 'light' };
  for (const name of ['FlatList', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View']) native[name] = name;
  const mocks = { '@/features/media/components/VideoEditor': { VideoEditor: 'VideoEditor' }, react: { useMemo: fn => fn(), useState: () => [390, () => {}], useRef: () => ({ current: null }), useEffect: fn => fn() }, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native, '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-image': { Image: 'Image' }, '@/theme/colors': { colors: { accent: '#007AFF' } } };
  function load(path) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
    return module.exports;
  }
  const { useProfileTheme } = load('src/features/profile/theme.ts');
  const { PhotoEditingStep } = load('src/features/journeys/components/PhotoEditingStep.tsx');
  const photos = [{ key: 'b', uri: 'file:///b.jpg', caption: 'Second\ncaption', place: null }, { key: 'a', uri: 'file:///a.jpg', caption: 'First caption', place: null }];
  const before = JSON.stringify(photos);
  for (dark of [false, true, false]) {
    const theme = useProfileTheme();
    const tree = PhotoEditingStep({ photos, activeKey: 'a', coverKey: 'b', theme });
    const input = nodes(tree, n => n.type === 'TextInput')[0];
    assert.equal(input.props.value, 'First caption');
    assert.equal(input.props.keyboardAppearance, dark ? 'dark' : 'light');
    assert.equal(input.props.placeholderTextColor, theme.subtle);
    assert.equal(flatten(input.props.style).color, theme.ink);
    const stage = nodes(tree, n => n.props?.onLayout)[0];
    assert.equal(flatten(stage.props.style).backgroundColor, theme.placeholder);
    const pager = nodes(tree, n => n.type === 'FlatList')[0];
    assert.equal(pager.props.initialScrollIndex, 1);
    const image = nodes(pager.props.renderItem({ item: photos[1] }), n => n.type === 'Image')[0];
    assert.equal(image.props.source.uri, photos[1].uri);
    assert.equal(image.props.contentFit, 'contain');
    assert.equal(image.props.tintColor, undefined);
    assert.equal(nodes(tree, n => n.props?.accessibilityLabel === 'Edit photo 1, journey cover').length, 1);
    assert.equal(JSON.stringify(photos), before);
  }
});
