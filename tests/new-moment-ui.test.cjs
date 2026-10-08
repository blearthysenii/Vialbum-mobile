const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, mocks = {}) {
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => mocks[name] ?? require(name)), AbortController, Error, Date, Map, setTimeout: fn => { fn(); return 0; }, clearTimeout() {} });
 return module.exports;
}
function mount(dark = false) {
 const slots = []; let cursor = 0; let effects = []; let creates = 0, uploads = 0, publishes = 0;
 const slot = init => { const i = cursor++; if (!(i in slots)) slots[i] = init(); return i; };
 const react = { useState(init) { const i = slot(() => init); return [slots[i], value => slots[i] = typeof value === 'function' ? value(slots[i]) : value]; }, useRef(value) { return slots[slot(() => ({ current: value }))]; }, useMemo(fn) { return slots[slot(fn)]; }, useCallback(fn) { return fn; }, useEffect(fn, deps) { const i = slot(() => null); if (!slots[i] || deps.some((value, j) => value !== slots[i][j])) effects.push(fn); slots[i] = deps; } };
 const jsx = (type, props) => ({ type, props });
 class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } interpolate() { return 1; } }
 const theme = { dark, canvas: dark ? '#000' : '#fff', ink: dark ? '#fff' : '#111', muted: '#777', accent: '#29f', danger: '#f44', border: '#333' };
 const ready = { id: 'draft', status: 'ready', creator: { id: 'owner' } };
 const mocks = {
  react, 'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { ...Object.fromEntries(['ActivityIndicator','KeyboardAvoidingView','Modal','Pressable','ScrollView','Text','TextInput','View'].map(name => [name,name])), Animated: { Value, View: 'AnimatedView', timing: () => ({ start() {}, stop() {} }) }, Alert: { alert() {} }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) }, Keyboard: { dismiss() {} }, Platform: { OS: 'ios' }, StyleSheet: { create: value => value, hairlineWidth: 0.5 } },
  'react-native-reanimated': { useReducedMotion: () => true },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  'react-native-gesture-handler': { Gesture: { Native: () => ({}) }, GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureRoot' },
  '@expo/vector-icons/Ionicons': { default: 'Icon' },
  'expo-router': { router: { back() {}, push() {}, replace() {} }, useFocusEffect() {}, useNavigation: () => ({ addListener: () => () => {} }), useLocalSearchParams: () => ({}) },
  'expo-haptics': { selectionAsync: async () => {}, notificationAsync: async () => {}, NotificationFeedbackType: { Success: 1 } },
  'expo-image-picker': { launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file://video.mov', fileName: 'video.mov', mimeType: 'video/quicktime', duration: 47000, fileSize: 1024 }] }) },
  'expo-media-library': {}, 'expo-file-system': { File: class {} },
  '@/features/journeys/draft': { requestId: () => 'request' },
  '@/features/auth/AuthProvider': { useAuth: () => ({ user: { id: 'owner' } }) },
  '@/features/journeys/JourneyProvider': { useJourneys: () => ({ journeys: [] }) },
  '@/features/places/api': { placeApi: { search: async () => [{ provider: 'test', provider_place_id: '1', name: 'San Siro', display_name: 'Milan, Italy', country_code: 'IT' }] } },
  '@/features/profile/theme': { useProfileTheme: () => theme },
  '@/features/media/components/VideoEditor': { VideoEditor: 'VideoEditor' },
  '@/features/media/videoEdit': load('src/features/media/videoEdit.ts'),
  './api': { countryFlag: () => 'IT', momentsApi: { create: async () => { creates++; return { ...ready, status: 'draft' }; }, upload: async (_id, _asset, _cover, progress) => { uploads++; progress(39); return ready; }, publish: async () => { publishes++; if (publishes === 1) throw Error('Network unavailable'); return { ...ready, status: 'published' }; } } },
  './playback': load('src/features/moments/playback.ts'), './suggestions': { suggestedMomentJourneys: () => [] },
  './publishMoment': load('src/features/moments/publishMoment.ts'), './VideoSurface': { VideoSurface: 'VideoSurface' },
 };
 const { CreateMoment } = load('src/features/moments/CreateMoment.tsx', mocks);
 return { render() { cursor = 0; effects = []; const tree = CreateMoment(); effects.forEach(fn => fn()); return tree; }, get counts() { return { creates, uploads, publishes }; } };
}
function nodes(tree, predicate) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(child => nodes(child,predicate)); return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children,predicate)]; }
function button(form, text) { return nodes(form.render(), node => node.type === 'Pressable' && nodes(node, child => child.type === 'Text' && child.props.children === text).length)[0].props; }
const flush = () => new Promise(resolve => setImmediate(resolve));
async function prepare(form) {
 button(form, 'Choose video').onPress(); await flush(); form.render();
 const search = nodes(form.render(), node => node.type === 'TextInput' && node.props.placeholder.startsWith('Search'))[0]; search.props.onChangeText('San Siro'); form.render(); await flush();
 button(form, 'San Siro').onPress(); form.render();
}
test('New Moment keeps Share disabled until real video range and explicit place are valid in both themes', async () => {
 for (const dark of [false,true]) {
  const form = mount(dark); assert.equal(button(form,'Share Moment').disabled,true);
  await prepare(form); assert.equal(button(form,'Share Moment').disabled,false);
  const editor = nodes(form.render(), node => node.type === 'VideoEditor')[0].props;
  assert.equal(editor.edit.trimEnd,47); assert.equal(editor.creationStyle,true);
  editor.onChange({ trimStart:0, trimEnd:61, coverTime:0 }); assert.equal(button(form,'Share Moment').disabled,true);
  editor.onChange({ trimStart:8, trimEnd:24, coverTime:12 }); assert.equal(button(form,'Share Moment').disabled,false);
  assert.equal(nodes(form.render(), node => node.type === 'TextInput' && node.props.multiline)[0].props.maxLength,280);
 }
});
test('redesigned publishing preserves the ready draft and retries without another upload or creation', async () => {
 const form = mount(); await prepare(form);
 button(form,'Share Moment').onPress(); await flush(); form.render();
 assert.equal(button(form,'Retry sharing').disabled,false);
 assert.deepEqual(form.counts,{ creates:1, uploads:1, publishes:1 });
 button(form,'Retry sharing').onPress(); await flush(); form.render();
 assert.deepEqual(form.counts,{ creates:1, uploads:1, publishes:2 });
});
