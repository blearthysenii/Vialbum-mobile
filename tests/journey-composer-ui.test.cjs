const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Error, __DEV__: false, require: require('./appearance-test-adapter.cjs').wrap(name => { if (name === './stops') return load('src/features/journeys/stops.ts', {}); assert.ok(mocks[name], name); return mocks[name]; }) });
  return module.exports;
}
const draftFns = load('src/features/journeys/draft.ts', {});
function mount({ publish = async () => 'journey', initial, picked = [], importFailure = false } = {}) {
  const hooks = []; let cursor = 0, pending = [], stored = initial;
  let createdId, leaveCount = 0, alertActions = [], guard, imports = 0;
  const jsx = (type, props) => typeof type === 'function' ? type(props) : ({ type, props });
  const useSlot = initializer => { const index = cursor++; if (!(index in hooks)) hooks[index] = initializer(); return index; };
  const react = {
    useState(initializer) { const i = useSlot(() => typeof initializer === 'function' ? initializer() : initializer); return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; },
    useMemo(fn, deps) { const i = useSlot(() => fn()); return hooks[i]; },
    useRef(value) { return hooks[useSlot(() => ({ current: value }))]; }, useCallback(fn) { return fn; },
    useEffect(fn, deps) { const i = useSlot(() => null); if (!hooks[i] || deps.some((dep, index) => dep !== hooks[i][index])) pending.push(fn); hooks[i] = deps; },
  };
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const mocks = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router/react-navigation': { usePreventRemove(value, callback) { guard = { value, callback }; } },
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, expo: { requireOptionalNativeModule: () => null },
    'expo-haptics': { selectionAsync: async () => {}, notificationAsync: async () => {}, NotificationFeedbackType: { Success: 1 } },
    'expo-router': { useFocusEffect() {} }, 'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native': { Alert: { alert: (_title, _copy, actions) => { alertActions = actions; } }, BackHandler: {}, Keyboard: { dismiss() {} }, Platform: { OS: 'ios' }, StyleSheet: { create: x => x }, ...Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, name])) },
    'react-native-gesture-handler': { Gesture: { Native: () => ({}) }, GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureRoot' },
    'react-native-safe-area-context': { SafeAreaView: 'Safe' },
    'react-native-reanimated': { default: { View: 'AnimatedView' }, FadeIn: { duration: () => null }, useReducedMotion: () => true },
    '@/api/client': { ApiError }, '@/components/ui/Button': { PrimaryButton: 'Primary' }, '@/components/ui/Feedback': { ErrorBanner: 'Error' },
    '@/features/auth/AuthProvider': { useAuth: () => ({ user: { id: 'owner' } }) },
    '../JourneyProvider': { useJourneys: () => ({ refresh: async () => {} }) }, '../api': { journeyApi: { fetchJourney: async () => ({ visibility: 'private', id: 'server' }), deleteJourney: async () => {} } }, '../draft': draftFns,
    '../draftStorage': { restoreDraft: async () => draftFns.normalizeDraft(stored), saveDraft: (_id, value) => { stored = structuredClone(value); }, clearDraft: async () => { stored = undefined; }, keepPhoto: async (_id, photo) => { imports++; if (importFailure) throw Error('iCloud unavailable'); return { ...photo, uri: `saved:${photo.key}`, requestId: photo.requestId ?? photo.key, caption: '', place: null, needsImport: false }; } },
    '../publishDraft': { publishDraft: publish },
    './JourneyStopsEditor': { JourneyStopsEditor: 'StopsEditor' }, './PhotoSelectionScreen': { PhotoSelectionScreen: 'Selection' }, './PhotoEditingStep': { PhotoEditingStep: 'Editor' }, './JourneyDetailsStep': { JourneyDetailsStep: 'Details' },
    '@/features/media/picker': { pickPhotos: async () => picked }, '@/features/places/components/LocationPicker': { LocationPicker: 'Location' },
    '@/features/profile/theme': { useProfileTheme: () => ({}) }, '@/theme/colors': { colors: {} },
    '@/features/discover/cache': { discoverStoreFor: () => ({ refresh: async () => {} }), followingStoreFor: () => ({ refresh: async () => {} }) },
  };
  const { NewJourneyForm } = load('src/features/journeys/components/NewJourneyForm.tsx', mocks);
  const onCreated = id => { createdId = id; }; const onCancel = () => { leaveCount++; };
  const render = () => { cursor = 0; pending = []; const tree = NewJourneyForm({ draftId: initial ? 'saved' : undefined, onCreated, onCancel }); pending.forEach(fn => fn()); return tree; };
  return { render, get stored() { return stored; }, get createdId() { return createdId; }, get leaveCount() { return leaveCount; }, get actions() { return alertActions; }, get guard() { return guard; }, get imports() { return imports; } };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const component = (form, type) => nodes(form.render(), node => node.type === type)[0]?.props;
const action = (form, label) => nodes(form.render(), node => node.props?.accessibilityLabel === label)[0].props.onPress();
const textAction = (form, label) => nodes(form.render(), node => node.type === 'Pressable' && nodes(node, child => child.type === 'Text' && child.props.children === label).length)[0].props.onPress();
const flush = () => new Promise(resolve => setImmediate(resolve));
const photo = key => ({ key, libraryId: key, uri: `ph://${key}`, name: key + '.jpg', mimeType: 'image/jpeg' });
function ready() { return { ...draftFns.newJourneyDraft(), step: 'details', coverKey: 'a', values: { ...draftFns.newJourneyDraft().values, title: 'Trip', destination: 'Paris', country: 'France', description: 'Whole trip' }, photos: ['a', 'b'].map(key => ({ ...photo(key), requestId: key, uri: `saved:${key}`, caption: '', place: null })) }; }

test('selection comes first, toggling renumbers, and edits follow identities through all steps', async () => {
  const form = mount();
  assert.equal(component(form, 'Selection').selected.length, 0);
  component(form, 'Selection').onToggle(photo('a'), false);
  component(form, 'Selection').onToggle(photo('b'), false);
  component(form, 'Selection').onToggle(photo('a'), false);
  assert.equal(component(form, 'Selection').selected[0].key, 'b');
  component(form, 'Selection').onToggle(photo('a'), false);
  component(form, 'Selection').onNext(); await flush();
  assert.equal(component(form, 'Editor').photos.length, 2);
  assert.equal(form.imports, 2);
  component(form, 'Editor').onCaption('a', 'A\ncaption');
  component(form, 'Editor').onCaption('b', 'B caption');
  component(form, 'Editor').onCover('a');
  component(form, 'Editor').onMove('a', -1);
  assert.equal(component(form, 'Editor').photos[0].caption, 'A\ncaption');
  textAction(form, 'Next');
  assert.equal(component(form, 'Details').cover.key, 'a');
  component(form, 'Details').onChange({ ...component(form, 'Details').values, description: 'Whole journey' });
  action(form, 'Back');
  assert.equal(component(form, 'Editor').photos[1].caption, 'B caption');
  component(form, 'Editor').onAdd();
  component(form, 'Selection').onToggle(photo('c'), false);
  component(form, 'Selection').onNext(); await flush();
  assert.equal(component(form, 'Editor').photos[0].caption, 'A\ncaption');
  assert.equal(form.stored.values.description, 'Whole journey');
});
test('close offers Save draft, Discard, Keep editing; saving finishes file copies', async () => {
  const form = mount();
  component(form, 'Selection').onToggle(photo('a'), false);
  component(form, 'Selection').onClose();
  assert.deepEqual(form.actions.map(item => item.text).join(','), 'Save draft,Discard,Keep editing');
  form.actions[2].onPress(); assert.equal(form.leaveCount, 0);
  component(form, 'Selection').onClose(); form.actions[0].onPress(); await flush(); form.render();
  assert.equal(form.leaveCount, 1);
  assert.equal(form.stored.photos[0].needsImport, false);
});
test('cancelled system picker changes nothing; failed imports preserve selected photos', async () => {
  const form = mount({ importFailure: true });
  component(form, 'Selection').onSystemPicker(); await flush();
  assert.equal(component(form, 'Selection').selected.length, 0);
  component(form, 'Selection').onToggle(photo('a'), false);
  component(form, 'Selection').onNext(); await flush();
  assert.equal(component(form, 'Selection').selected.length, 1);
  assert.match(component(form, 'Selection').error, /iCloud/);
});
test('missing restored photos remain editable and prevent final submission', async () => {
  let calls = 0; const initial = ready(); initial.photos[0].unavailable = true;
  const form = mount({ initial, publish: async () => { calls++; return 'id'; } });
  form.render(); await flush();
  component(form, 'Primary').onPress(); await flush();
  assert.equal(calls, 0);
  assert.match(component(form, 'Error').message, /unavailable/);
  action(form, 'Back');
  assert.equal(component(form, 'Editor').photos[0].unavailable, true);
});
test('rapid submission sends one request; failure retains draft for retry', async () => {
  let calls = 0, reject;
  const form = mount({ initial: ready(), publish: () => { calls++; return new Promise((_resolve, fail) => { reject = fail; }); } });
  form.render(); await flush();
  const button = component(form, 'Primary'); button.onPress(); button.onPress(); await flush();
  assert.equal(calls, 1); reject(Error('Offline')); await flush();
  assert.equal(form.stored.photos.length, 2);
  assert.match(component(form, 'Error').message, /Create journey to retry/);
  assert.equal(component(form, 'Primary').loading, false);
});
test('success clears only the completed draft and releases navigation guard', async () => {
  const form = mount({ initial: ready() }); form.render(); await flush();
  component(form, 'Primary').onPress(); await flush(); form.render();
  assert.equal(form.createdId, 'journey'); assert.equal(form.stored, undefined); assert.equal(form.guard.value, false);
});

function place(name, latitude = '45.4642', longitude = '9.1900') {
  return { provider: 'test', provider_place_id: name, name, display_name: name,
    locality: name, region: null, country: 'Italy', country_code: 'IT', latitude, longitude };
}
function selectLocation(form, key, location) {
  component(form, 'Editor').onLocation(key);
  component(form, 'Location').onChange({ place: location,
    coordinate: { latitude: Number(location.latitude), longitude: Number(location.longitude) } });
}
test('iOS legacy string coordinates open LocationPicker and old drafts retain their locations', async () => {
  const initial = ready(); initial.step = 'photos';
  initial.photos[0] = { ...initial.photos[0], latitude: '45.4642', longitude: '9.19', place: place('Milan'), caption: 'Retained caption' };
  const form = mount({ initial }); form.render(); await flush();
  component(form, 'Editor').onLocation('a');
  assert.equal(component(form, 'Location').latitude, '45.464200');
  assert.equal(component(form, 'Location').longitude, '9.190000');
  component(form, 'Location').onCancel();
  assert.equal(component(form, 'Location'), undefined);
  assert.equal(component(form, 'Editor').photos[0].caption, 'Retained caption');
  assert.equal(component(form, 'Editor').photos[0].place.name, 'Milan');
});
test('single photo location can be selected, reopened, edited and cancelled', async () => {
  const form = mount(); component(form, 'Selection').onToggle(photo('a'), false);
  component(form, 'Selection').onNext(); await flush();
  selectLocation(form, 'a', place('Milan'));
  component(form, 'Editor').onLocation('a');
  assert.equal(component(form, 'Location').place.name, 'Milan');
  component(form, 'Location').onCancel();
  selectLocation(form, 'a', place('San Siro', '45.478', '9.124'));
  assert.equal(component(form, 'Editor').photos[0].place.name, 'San Siro');
  assert.equal(form.stored.photos[0].latitude, 45.478);
});
test('different image/video locations and stops remain attached by identity after reordering', async () => {
  const form = mount();
  for (const item of [photo('a'), photo('b'), { ...photo('c'), type: 'video', mimeType: 'video/quicktime', duration: 20 }]) component(form, 'Selection').onToggle(item, false);
  component(form, 'Selection').onNext(); await flush();
  component(form, 'Editor').onCaption('a', 'Milan caption');
  selectLocation(form, 'a', place('Milan'));
  selectLocation(form, 'b', place('San Siro', '45.478', '9.124'));
  selectLocation(form, 'c', place('Lake Como', '46', '9.3'));
  component(form, 'Editor').onMove('c', -1);
  const media = component(form, 'Editor').photos;
  assert.equal(media.map(item => item.key).join(','), 'a,c,b');
  assert.equal(media.map(item => item.place.name).join(','), 'Milan,Lake Como,San Siro');
  assert.equal(media[0].caption, 'Milan caption'); assert.equal(media[1].type, 'video');
  const stopButton = nodes(form.render(), node => node.type === 'Pressable' && nodes(node, child => child.type === 'Text' && Array.isArray(child.props.children) && child.props.children[0] === 'Journey stops · ').length)[0];
  stopButton.props.onPress();
  const stops = component(form, 'StopsEditor');
  assert.equal(stops.stops.map(stop => stop.mediaKeys.join(',')).join(';'), 'a;c;b');
  stops.onSave(stops.stops); stops.onClose();
  component(form, 'Editor').onLocation('c'); component(form, 'Location').onCancel();
  assert.equal(form.stored.stopsReviewed, true);
  assert.equal(form.stored.photos.map(item => item.key).join(','), 'a,c,b');
});
test('coordinate normalization preserves zero and rejects invalid bridge values', () => {
  for (const value of [0, '0', '-45.5', 45.5]) assert.equal(draftFns.mediaCoordinate(value, 90), Number(value));
  for (const value of [null, undefined, '', ' ', 'NaN', Infinity, '91', {}, true]) assert.equal(draftFns.mediaCoordinate(value, 90), undefined);
});
test('real library resolver normalizes the legacy iOS string location before keeping media', async () => {
  const library = load('src/features/journeys/library.ts', {
    expo: { requireOptionalNativeModule: () => ({}) }, 'react-native': { Platform: { OS: 'ios' } },
    './draft': draftFns, 'expo-media-library/legacy': { getAssetInfoAsync: async () => ({ localUri: 'file://photo.jpg', location: { latitude: '45.4642', longitude: '9.19' } }) },
  });
  const resolved = await library.resolvePhoto(photo('a'));
  assert.equal(resolved.latitude, 45.4642); assert.equal(resolved.longitude, 9.19);
});
