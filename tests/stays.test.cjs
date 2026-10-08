const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Error, AbortController, setTimeout, clearTimeout, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  return module.exports;
}
const requests = [];
const api = load('src/features/stays/api.ts', { '@/api/client': { apiRequest: async (path, options) => { requests.push({ path, options }); return {}; } } });
test('Stays requests use existing authenticated API client and preserve provider identity', async () => {
  await api.staysApi.search('journey', 'Arlo & hotel', 2);
  await api.staysApi.add('journey', { place: { provider: 'geoapify', provider_place_id: 'same-real-id' }, tip: 'Walkable' });
  await api.staysApi.edit('recommendation', 'Updated'); await api.staysApi.remove('recommendation');
  assert.ok(requests.every(request => request.options.authenticated));
  assert.match(requests[0].path, /q=Arlo%20%26%20hotel&destination_index=2/);
  assert.equal(requests[1].options.body.place.provider_place_id, 'same-real-id');
  assert.equal(requests[2].options.method, 'PATCH'); assert.equal(requests[3].options.method, 'DELETE');
});
test('provider stays map to real coordinates; manual stays never get invented pins', () => {
  assert.equal(api.stayPoint({ manual: true, place: null }), null);
  const point = api.stayPoint({ id: 'stay', name: 'Apartment', place: { latitude: '45.4', longitude: '9.2' } });
  assert.equal(point.latitude, 45.4); assert.equal(point.longitude, 9.2);
  assert.equal(api.stayCategory('accommodation.guest_house'), 'Guest house');
});
function mount({ own = false, fail = false, dark = false } = {}) {
  let cursor = 0, pending = [], remote = [], focused, menuRequest, confirmation; const slots = [];
  const slot = initializer => { const index = cursor++; if (!(index in slots)) slots[index] = initializer(); return index; };
  const react = {
    useState(initial) { const i = slot(() => initial); return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(value) { return slots[slot(() => ({ current: value }))]; }, useCallback(fn, deps) { const i = slot(() => null); if (!slots[i] || deps.some((value, j) => value !== slots[i].deps[j])) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = slot(() => null); if (!slots[i] || deps.some((value, j) => value !== slots[i][j])) pending.push(fn); slots[i] = deps; },
  };
  const mockApi = { ...api, staysApi: { list: async () => { if (fail) throw Error('Slow connection failed'); return { destinations: [{ name: 'Milan', country: 'Italy' }], journey_items: remote, items: [], areas: [], next_offset: null }; } } };
  const rn = Object.fromEntries(['ActivityIndicator', 'Alert', 'KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name]));
  const { StaysTab } = load('src/features/stays/StaysTab.tsx', {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-image': { Image: 'Image' }, 'expo-router': { router: {}, useFocusEffect: fn => { focused = fn; react.useEffect(fn, [fn]); } },
    'react-native': { ...rn, ActionSheetIOS: { showActionSheetWithOptions: (options, select) => { menuRequest = { options, select }; } }, Alert: { alert: (...args) => { confirmation = args; } }, Platform: { OS: 'ios' }, StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { SafeAreaView: 'Safe' },
    'react-native-maps': { default: 'Map', Marker: 'Marker' },
    './StayUI': { Action: 'Action', Sheet: 'Sheet' },
    './StayGallery': { StayGallery: 'Gallery' }, './StayDetail': { StayDetail: 'StayDetail' }, './StayGlass': { GlassButton: 'GlassButton' },
    './StayCard': { StayCard: 'StayCard', StayMetadata: 'Metadata', BookingChip: 'BookingChip', RecommendationText: 'RecommendationText', Recommender: 'Recommender' }, './StayEditor': { StayEditor: 'StayEditor' }, '@/features/posts/data': { postTarget() {} },
    '@/features/profile/components/ProfileAvatarImage': { ProfileAvatarImage: 'Avatar' }, './api': mockApi,
  });
  const onMarkers = () => {}, onMap = () => {};
  const theme = { dark, canvas: dark ? '#080808' : '#fff', ink: dark ? '#fff' : '#111', muted: '#888', placeholder: dark ? '#171717' : '#eee', accent: '#247' };
  const render = () => { cursor = 0; pending = []; const tree = StaysTab({ journey: { id: 'journey', destination: 'Milan', photos: [] }, own, theme, onMap, onMarkers }); pending.forEach(fn => fn()); return tree; };
  return { render, refocus: () => focused(), setRemote: value => { remote = value; }, get menuRequest() { return menuRequest; }, get confirmation() { return confirmation; } };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const flush = () => new Promise(resolve => setImmediate(resolve));
for (const dark of [false, true]) test(`Stays empty discovery and owner controls render in ${dark ? 'Dark' : 'Light'} Mode`, async () => {
  const visitor = mount({ dark }); visitor.render(); await flush();
  const tree = visitor.render(); assert.ok(nodes(tree, node => node.props?.children === 'No stays shared yet').length);
  assert.equal(nodes(tree, node => node.props?.label === 'Recommend a stay').length, 0);
  const owner = mount({ own: true, dark }); owner.render(); await flush();
  const add = nodes(owner.render(), node => node.props?.label === 'Recommend a stay')[0]; add.props.onPress();
  assert.ok(nodes(owner.render(), node => node.props?.own === true && Array.isArray(node.props?.destinations)).length);
});
test('API failure exposes retry without fabricated stay cards', async () => {
  const form = mount({ fail: true }); form.render(); await flush();
  const tree = form.render(); assert.ok(nodes(tree, node => node.props?.label === 'Retry').length);
  assert.equal(nodes(tree, node => node.props?.label === 'Explore stays').length, 0);
  assert.ok(nodes(tree, node => node.props?.accessibilityRole === 'alert' && node.props.children === 'Slow connection failed').length);
});


test('returning to a mounted public Journey refetches Stays from the backend', async () => {
  const visitor = mount(); visitor.render(); await flush();
  assert.ok(nodes(visitor.render(), node => node.props?.children === 'No stays shared yet').length);
  visitor.setRemote([{ id: 'manual-stay', name: 'Flat in Cologno Monzese', city: 'Cologno Monzese',
    manual: true, place: null, traveler_count: 1, tips: [], photos: [],
    accommodation_type: 'apartment', booking_source: 'airbnb' }]);
  visitor.refocus(); await flush();
  const tree = visitor.render();
  assert.ok(nodes(tree, node => node.type === 'StayCard' && node.props.stay.name === 'Flat in Cologno Monzese').length);
  assert.equal(nodes(tree, node => node.props?.label === 'Recommend a stay').length, 0);
  visitor.setRemote([]); visitor.refocus(); await flush();
  assert.ok(nodes(visitor.render(), node => node.props?.children === 'No stays shared yet').length);
});


test('multiple cards expose owner-only native Edit/Remove actions and real safe map targets', async () => {
  const form = mount({ own: true }); form.render(); await flush();
  const tip = { id: 'own-rec', own: true, published: true };
  const base = { name: 'Flat', city: 'Cologno Monzese', manual: true, place: null,
    location: { latitude: '45.528', longitude: '9.278' }, traveler_count: 1, photos: [] };
  form.setRemote([{ ...base, id: 'own-stay', tips: [tip] }, { ...base, id: 'visitor-stay', tips: [{ ...tip, id: 'other-rec', own: false }] }]);
  form.refocus(); await flush();
  const cards = nodes(form.render(), node => node.type === 'StayCard');
  assert.equal(cards.length, 2); assert.equal(typeof cards[0].props.onMenu, 'function');
  assert.equal(cards[1].props.onMenu, undefined); assert.equal(typeof cards[0].props.onMap, 'function');
  cards[0].props.onMenu();
  assert.equal(form.menuRequest.options.destructiveButtonIndex, 3);
  assert.equal(form.menuRequest.options.options.join(','), 'Cancel,Add photos,Edit stay,Remove stay');
  form.menuRequest.select(1);
  assert.equal(nodes(form.render(), node => node.type === 'StayEditor')[0].props.initial.id, 'own-rec');
  cards[0].props.onMenu(); form.menuRequest.select(3);
  assert.equal(form.confirmation[0], 'Remove recommendation?');
  assert.equal(form.confirmation[2][1].style, 'destructive');
});
