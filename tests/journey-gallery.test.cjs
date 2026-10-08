const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const photo = key => ({ key, uri: `ph://${key}`, name: key, libraryId: key, mimeType: 'image/jpeg' });
function mount(library, selected = []) {
  let dark = false;
  const state = []; let cursor = 0, effects = [], selection = selected, toggles = 0, picked = 0;
  const jsx = (type, props) => ({ type, props });
  const slot = init => { const i = cursor++; if (!(i in state)) state[i] = init(); return i; };
  const changed = (a, b) => !a || b.some((item, i) => item !== a[i]);
  const react = {
    useState(init) { const i = slot(() => typeof init === 'function' ? init() : init); return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(init) { return state[slot(() => ({ current: init }))]; },
    useCallback(fn, deps) { const i = slot(() => null); if (!state[i] || changed(state[i].deps, deps)) state[i] = { fn, deps }; return state[i].fn; },
    useEffect(fn, deps) { const i = slot(() => null); if (!state[i] || changed(state[i], deps)) effects.push(fn); state[i] = deps; },
  };
  const mocks = {
    '@/features/profile/theme': { useProfileTheme: () => ({ dark, canvas: dark ? '#000000' : '#FFFFFF', ink: dark ? '#F5F5F7' : '#111111', muted: dark ? '#A1A1A6' : '#777773', placeholder: dark ? '#343438' : '#EEEDEA', glassStrong: dark ? '#222222' : '#F8F8F8', border: dark ? '#444444' : '#DDDDDD', divider: dark ? '#333333' : '#EEEEEE' }) },
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-image': { Image: 'Image' }, 'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native': { ActivityIndicator: 'Spinner', AppState: { addEventListener: () => ({ remove() {} }) }, FlatList: 'List', Linking: { openSettings: async () => {} }, Modal: 'Modal', Pressable: 'Button', StyleSheet: { create: value => value }, Text: 'Text', View: 'View', useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-safe-area-context': { SafeAreaView: 'Safe' }, '../draft': { photoIdentity: photo => photo.libraryId ?? photo.key }, '../library': { deviceLibrary: () => library, assetPhoto: asset => photo(asset.id) }, '@/theme/colors': { colors: { accent: '#007AFF', onDark: 'white' } },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/journeys/components/PhotoSelectionScreen.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { module, exports: module.exports, Error, setTimeout, clearTimeout, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  const render = () => {
    cursor = 0; effects = [];
    const tree = module.exports.PhotoSelectionScreen({ selected: selection, busy: false, error: null, onToggle: item => { toggles++; const index = selection.findIndex(photo => photo.key === item.key); selection = index >= 0 ? selection.filter(photo => photo.key !== item.key) : [...selection, item]; }, onSystemPicker: () => picked++, onNext() {}, onClose() {} });
    effects.forEach(fn => fn()); return tree;
  };
  return { render, setDark(value) { dark = value; }, get toggles() { return toggles; }, get picked() { return picked; } };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const grid = form => nodes(form.render(), node => node.type === 'List' && node.props.numColumns === 4)[0].props;
const permissionLibrary = permission => ({ getPermissionsAsync: async () => permission, requestPermissionsAsync: async () => permission, getAlbumsAsync: async () => [{ id: 'album', title: 'Trips', assetCount: 1 }], addListener: () => ({ remove() {} }), getAssetsAsync: async () => ({ assets: [{ id: 'real-device-photo' }], endCursor: 'cursor', hasNextPage: false }) });
test('unavailable native library offers system picker and selection-only grid without fake photos', () => {
  const form = mount(null); assert.equal(grid(form).data.length, 0);
  const next = nodes(form.render(), node => node.props?.accessibilityLabel === 'Next, edit selected photos')[0].props;
  assert.equal(next.disabled, true);
  const button = nodes(form.render(), node => node.type === 'Button' && nodes(node, child => child.props?.children === 'Choose photos and videos').length)[0];
  button.props.onPress(); assert.equal(form.picked, 1);
});
test('limited access loads real assets and badges renumber after deselection', async () => {
  const form = mount(permissionLibrary({ granted: true, accessPrivileges: 'limited' })); form.render(); await flush();
  const data = grid(form).data; assert.equal(data[0].key, 'real-device-photo');
  assert.ok(nodes(form.render(), node => node.props?.children === 'Showing the photos you allowed.').length);
  let cell = grid(form).renderItem({ item: data[0] }); cell.props.onPress();
  cell = grid(form).renderItem({ item: data[0] }); assert.equal(cell.props.accessibilityState.selected, true);
  assert.ok(nodes(cell, node => node.props?.children === 1).length);
  cell.props.onPress(); assert.equal(grid(form).renderItem({ item: data[0] }).props.accessibilityState.selected, false);
});
test('denied permission does not query assets and keeps a system-picker fallback', async () => {
  const library = permissionLibrary({ granted: false, canAskAgain: false, accessPrivileges: 'none' });
  let queries = 0; library.getAssetsAsync = async () => { queries++; return {}; };
  const form = mount(library); form.render(); await flush();
  assert.equal(queries, 0); assert.equal(grid(form).data.length, 0);
  assert.ok(nodes(form.render(), node => node.props?.children === 'Settings').length);
});
test('gallery paginates, deduplicates assets and ignores old pages after changing albums', async () => {
  const calls = []; let resolveOld;
  const library = permissionLibrary({ granted: true, accessPrivileges: 'all' });
  library.getAssetsAsync = async options => {
    calls.push(options);
    if (options.album) return { assets: [{ id: 'new-album' }], endCursor: 'new', hasNextPage: false };
    if (options.after) return new Promise(resolve => { resolveOld = resolve; });
    return { assets: [{ id: 'recent' }], endCursor: 'recent-cursor', hasNextPage: true };
  };
  const form = mount(library); form.render(); await flush();
  grid(form).onEndReached();
  assert.equal(calls[1].after, 'recent-cursor'); assert.equal(calls[0].first, 60);
  const albumList = nodes(form.render(), node => node.type === 'List' && !node.props.numColumns)[0].props;
  albumList.renderItem({ item: albumList.data[1] }).props.onPress(); await flush();
  resolveOld({ assets: [{ id: 'stale-recent' }], endCursor: 'stale', hasNextPage: false }); await flush();
  assert.deepEqual(Array.from(grid(form).data, item => item.key), ['new-album']);
});

test('live appearance changes theme gallery, album sheet and status bar without losing selection or preview', async () => {
  const form = mount(permissionLibrary({ granted: true, accessPrivileges: 'all' }));
  form.render(); await flush();
  const item = grid(form).data[0]; grid(form).renderItem({ item }).props.onPress();
  const flatten = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  for (const dark of [false, true, false]) {
    form.setDark(dark); const tree = form.render();
    assert.equal(flatten(tree.props.style).backgroundColor, dark ? '#000000' : '#FFFFFF');
    assert.equal(nodes(tree, n => n.type === 'StatusBar')[0].props.style, dark ? 'light' : 'dark');
    const modal = nodes(tree, n => n.type === 'Modal')[0];
    assert.equal(flatten(nodes(modal, n => n.type === 'Safe')[0].props.style).backgroundColor, dark ? '#000000' : '#FFFFFF');
    assert.equal(nodes(tree, n => n.props?.accessibilityLabel === 'Active photo preview')[0].props.source.uri, item.uri);
    assert.equal(grid(form).renderItem({ item }).props.accessibilityState.selected, true);
    assert.equal(grid(form).extraData.dark, dark);
  }
});
