const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Error, AbortController, setTimeout, clearTimeout, __DEV__: false, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  return module.exports;
}
const draft = () => ({ request_id: 'stable-create-key', input: { manual_name: 'Flat in Cologno Monzese', accommodation_type: 'apartment', booking_source: 'airbnb', manual_location: { name: 'Cologno Monzese', country: 'Italy', latitude: '45.528', longitude: '9.278' }, tip: 'A quiet and comfortable place to stay, with easy metro access to central Milan.' }, photos: [1, 2].map(i => ({ key: `photo-${i}`, uri: `file://photo-${i}.jpg`, name: 'photo.jpg', mimeType: 'image/jpeg', request_id: `upload-${i}` })), removed: [] });
const flush = () => new Promise(resolve => setImmediate(resolve));
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function mount(publish, options = {}) {
  let cursor = 0, pending = [], stored = 'draft' in options ? options.draft : draft(), saved = 0, closed = 0, alerts = [], writes = 0;
  const slots = [], user = { id: 'owner' };
  const slot = initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial(); return i; };
  const react = {
    useState(initial) { const i = slot(() => typeof initial === 'function' ? initial() : initial); return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(value) { return slots[slot(() => ({ current: value }))]; },
    useEffect(fn, deps) { const i = slot(() => null); if (!slots[i] || deps.some((v, j) => v !== slots[i][j])) pending.push(fn); slots[i] = deps; },
  };
  const { StayEditor } = load('src/features/stays/StayEditor.tsx', {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-image': { Image: 'Image' },
    'expo-haptics': { selectionAsync: async () => {}, notificationAsync: async () => {}, NotificationFeedbackType: { Success: 'success' } },
    'react-native': { Platform: { OS: 'ios' }, ActionSheetIOS: { showActionSheetWithOptions: (config, callback) => { alerts.push([config, callback]); } }, ActivityIndicator: 'Spinner', Alert: { alert: (...args) => alerts.push(args) }, Pressable: 'Pressable', ScrollView: 'Scroll', Text: 'Text', TextInput: 'Input', View: 'View', StyleSheet: { create: v => v } },
    '@/features/auth/AuthProvider': { useAuth: () => ({ user }) }, '@/features/journeys/draft': { requestId: () => 'new-key' },
    '@/features/media/picker': { pickPhotos: async () => options.picked ?? [] }, '@/features/places/components/LocationPicker': { LocationPicker: 'Location' },
    './api': { accommodationTypes: { apartment: 'Apartment' }, bookingSources: { airbnb: 'Airbnb' }, bookedVia: () => 'Booked via Airbnb', staysApi: { search: async () => [], remove: options.remove ?? (async () => {}) } },
    './editorDraft': { loadStayDraft: () => stored, storeStayDraft: (_, __, value) => { stored = value; writes++; }, clearStayDraft: () => { stored = null; }, keepStayPhoto: async (_, __, photo) => photo },
    './StayGlass': { GlassButton: 'Glass', GlassBackdrop: 'GlassBackdrop' }, '@/theme/spacing': { spacing: { sm: 10, md: 16, lg: 24, xl: 32, screen: 22 } }, './publishEditor': { publishStayEditor: publish }, './StayUI': { Action: 'Action', Sheet: 'Sheet' },
  });
  const journey = { id: 'milan', destination: 'Milan' }, theme = { dark: !!options.dark, ink: 'ink', muted: 'muted', elevatedSurface: options.dark ? 'darkSurface' : 'lightSurface' }, destinations = [];
  const render = () => { cursor = 0; pending = []; const tree = StayEditor({ journey, destinations, own: true, initial: options.initial, theme, onClose: () => closed++, onSaved: () => saved++, onMap: () => {} }); pending.forEach(fn => fn()); return tree; };
  const action = label => nodes(render(), node => (node.type === 'Action' || node.type === 'Glass') && node.props.label === label)[0].props;
  return { render, action, get stored() { return stored; }, get saved() { return saved; }, get closed() { return closed; }, get alerts() { return alerts; }, get writes() { return writes; } };
}
test('restored local stay is explicitly a draft; Close and Review do not publish', () => {
  let requests = 0;
  const form = mount(async () => { requests++; }); form.render();
  let tree = form.render();
  assert.equal(nodes(tree, n => n.type === 'Input' && n.props.accessibilityLabel === 'Stay name')[0].props.value, 'Flat in Cologno Monzese');
  assert.equal(nodes(tree, n => n.type === 'Image').length, 2);
  assert.equal(tree.props.closeLabel, 'Close');
  tree.props.onClose(); assert.equal(form.closed, 0);
  form.alerts[0][2].find(button => button.text === 'Save draft').onPress();
  assert.equal(form.closed, 1); assert.equal(requests, 0);
  form.action('Share stay').onPress();
  assert.ok(form.action('Share stay')); assert.equal(form.render().props.title, 'Recommend a stay'); assert.equal(requests, 0);
});
test('publication waits for confirmed server response and cannot recreate a completed draft', async () => {
  let resolve;
  const form = mount(() => new Promise(done => { resolve = done; })); form.render();
  form.action('Share stay').onPress(); form.action('Share stay').onPress();
  assert.equal(form.saved, 0); assert.equal(form.render().props.closeDisabled, true);
  resolve({ id: 'persisted-stay', published: true }); await flush();
  assert.equal(form.saved, 1); assert.equal(form.stored, null);
  form.render(); assert.equal(form.stored, null);
});
test('upload/publication failure keeps the editor and draft; unconfirmed publication cannot close', async () => {
  for (const publish of [async () => { throw Error('Upload failed'); }, async () => ({ id: 'stay', published: false })]) {
    const form = mount(publish); form.render(); form.action('Share stay').onPress(); form.action('Share stay').onPress(); await flush();
    assert.equal(form.saved, 0); assert.equal(form.closed, 0); assert.equal(form.stored.photos.length, 2);
    assert.ok(nodes(form.render(), n => n.props?.accessibilityRole === 'alert').length);
  }
});
test('partial photo upload checkpoints retry without another create or duplicate successful photo', async () => {
  let value = draft(), fail = true, creates = 0, uploads = [], published = 0;
  const { publishStayEditor } = load('src/features/stays/publishEditor.ts', { './api': { staysApi: {
    add: async (_, input) => { creates++; assert.equal(input.request_id, 'stable-create-key'); assert.equal(input.draft, true); return { id: 'stay' }; },
    edit: async () => {}, deletePhoto: async () => {},
    upload: async (_, photo) => { uploads.push(photo.request_id); if (photo.key === 'photo-2' && fail) throw Error('Storage failed'); return { id: photo.key, url: 'signed-url', position: 0 }; },
    order: async (_, ids) => { assert.equal(ids.join(','), 'photo-1,photo-2'); },
    publish: async () => { published++; return { id: 'stay', published: true }; },
  } } });
  await assert.rejects(publishStayEditor('milan', value, next => { value = next; }, () => {}), /Storage failed/);
  assert.equal(published, 0); assert.equal(value.recommendationId, 'stay'); assert.ok(value.photos[0].server);
  fail = false;
  assert.equal((await publishStayEditor('milan', value, next => { value = next; }, () => {})).published, true);
  assert.equal(creates, 1); assert.equal(uploads.join(','), 'upload-1,upload-2,upload-2'); assert.equal(published, 1);
});

for (const dark of [false, true]) for (const count of [0, 1, 2, 3]) test(`form preserves ${count} photos, themed fields, review and 300-char tip: dark=${dark}`, () => {
  const value = draft(); value.photos = Array.from({ length: count }, (_, i) => ({ key: `photo-${i}`, uri: `file://${i}` })); value.input.tip = 'x'.repeat(300);
  const form = mount(async () => {}, { draft: value, dark }); form.render(); const tree = form.render();
  assert.equal(nodes(tree, n => n.type === 'Image').length, count);
  assert.equal(nodes(tree, n => n.props?.accessibilityLabel === (count === 2 ? 'Add photo' : 'Add photos')).length, count < 3 ? 1 : 0);
  const input = nodes(tree, n => n.type === 'Input' && n.props.accessibilityLabel === 'Your stay tip')[0];
  assert.equal(input.props.maxLength, 300); assert.equal(input.props.value.length, 300);
  assert.equal(input.props.placeholder, 'Share your experience, tips or anything helpful…');
  assert.equal(nodes(tree, n => Array.isArray(n.props?.children) && n.props.children.join('') === '300/300').length, 1);
  assert.equal(form.action('Share stay').disabled, false);
  const selectors = nodes(tree, n => typeof n.type === 'function' && n.type.name === 'Selector');
  assert.equal(selectors.length, 3);
  selectors[0].props.onPress();
  assert.ok(nodes(form.render(), n => n.type === 'Sheet' && n.props.title === 'Accommodation type').length);
  assert.equal(tree.props.closeControl.props.label, 'Close');
  const scroll = nodes(tree, n => n.type === 'Scroll')[0];
  assert.equal(scroll.props.keyboardShouldPersistTaps, 'handled'); assert.equal(scroll.props.keyboardDismissMode, 'interactive');
});
test('blank manual form disables review until required fields are set; optional fields stay optional', () => {
  const form = mount(async () => {}, { draft: null }); form.render();
  form.action('+ Add manually').onPress();
  assert.equal(form.action('Share stay').disabled, true);
  let tree = form.render();
  nodes(tree, n => n.type === 'Input' && n.props.accessibilityLabel === 'Stay name')[0].props.onChangeText('Flat');
  nodes(tree, n => typeof n.type === 'function' && n.type.name === 'Selector')[0].props.onPress();
  form.action('Apartment').onPress();
  tree = form.render(); nodes(tree, n => typeof n.type === 'function' && n.type.name === 'Selector')[1].props.onPress();
  nodes(form.render(), n => n.type === 'Location')[0].props.onChange({ place: { name: 'Milan', country: 'Italy', latitude: '45', longitude: '9' } });
  assert.equal(form.action('Share stay').disabled, false);
  assert.equal(form.stored.photos.length, 0);
});
test('provider stay retains its selected location and disables manual location editing', () => {
  const value = draft(); delete value.input.manual_name; delete value.input.manual_location;
  value.input.place = { name: 'Real selected hotel', country: 'Italy', latitude: '45', longitude: '9' };
  const form = mount(async () => {}, { draft: value }); form.render();
  const selectors = nodes(form.render(), n => typeof n.type === 'function' && n.type.name === 'Selector');
  assert.equal(selectors[1].props.disabled, true);
  assert.equal(form.action('Share stay').disabled, false);
  assert.equal(form.stored.input.place.name, 'Real selected hotel');
});


const existing = { id: 'existing', published: true, name: 'Flat', manual: true, accommodation_type: 'apartment', location: draft().input.manual_location, photos: [] };
const button = (form, label) => nodes(form.render().props.closeControl, n => n.props?.accessibilityLabel === label)[0]?.props ?? nodes(form.render(), n => n.props?.accessibilityLabel === label)[0]?.props;
const menuAction = (form, text) => { const [config, callback] = form.alerts.at(-1); callback(config.options.indexOf(text)); };
test('Done dismisses unchanged edits and directly saves changed edits with duplicate protection', async () => {
  let published = 0;
  const form = mount(async () => { published++; return { id: 'existing', published: true }; }, { initial: existing, draft: null }); form.render();
  button(form, 'Done').onPress(); assert.equal(form.closed, 1); assert.equal(published, 0);
  const changed = mount(async () => { published++; return { id: 'existing', published: true }; }, { initial: existing, draft: null }); changed.render();
  nodes(changed.render(), n => n.props?.accessibilityLabel === 'Your stay tip')[0].props.onChangeText('Updated');
  const done = button(changed, 'Done'); done.onPress(); done.onPress(); await flush();
  assert.equal(published, 1); assert.equal(changed.saved, 1); assert.equal(changed.stored, null);
});
for (const dark of [false, true]) test(`photo menus preserve cover, order, replacement and count transitions: dark=${dark}`, async () => {
  const value = draft(); value.photos = [0, 1, 2].map(i => ({ key: `p${i}`, uri: `signed:${i}`, server: { id: `p${i}` } }));
  const form = mount(async () => {}, { draft: value, dark, picked: [{ key: 'new', uri: 'file:new' }] }); form.render();
  assert.equal(button(form, 'Add photos'), undefined);
  form.action('Options for photo 3').onPress(); menuAction(form, 'Make cover'); form.render();
  assert.equal(form.stored.photos[0].key, 'p2');
  assert.equal(nodes(form.render(), n => n.props?.accessibilityLabel === 'Stay cover photo')[0].props.source.uri, 'signed:2');
  form.action('Options for photo 1').onPress(); menuAction(form, 'Move later'); form.render(); assert.equal(form.stored.photos[0].key, 'p0');
  form.action('Options for photo 2').onPress(); menuAction(form, 'Replace photo'); await flush(); form.render();
  assert.equal(form.stored.photos[1].key, 'new'); assert.equal(form.stored.photos[1].replace_id, 'p2');
  form.action('Options for photo 1').onPress(); menuAction(form, 'Remove photo'); form.render();
  assert.equal(form.stored.photos[0].key, 'new'); assert.ok(button(form, 'Add photo'));
  button(form, 'Add photo').onPress(); await flush(); form.render(); assert.equal(button(form, 'Add photo'), undefined);
  for (const label of ['Add photo', 'Add photos', 'Add photos']) {
    form.action('Options for photo 1').onPress(); menuAction(form, 'Remove photo'); form.render(); assert.ok(button(form, label));
  }
});
test('Delete stay requires confirmation, prevents duplicate requests, refreshes on success and keeps edits on failure', async () => {
  for (const fail of [false, true]) {
    let requests = 0;
    const form = mount(async () => {}, { initial: existing, draft: null, remove: async () => { requests++; if (fail) throw Error('Delete failed'); } }); form.render();
    button(form, 'Delete stay').onPress(); assert.equal(requests, 0);
    const actions = form.alerts.at(-1)[2]; assert.equal(actions[0].style, 'cancel'); const confirm = actions.find(a => a.text === 'Delete'); assert.equal(confirm.style, 'destructive');
    confirm.onPress(); confirm.onPress(); await flush(); assert.equal(requests, 1); assert.equal(form.saved, fail ? 0 : 1);
    if (fail) { assert.ok(form.stored); assert.equal(nodes(form.render(), n => n.props?.accessibilityRole === 'alert').length, 1); }
  }
});
test('edit save failure preserves edits and unsaved dismissal offers keep, draft and discard', async () => {
  const form = mount(async () => { throw Error('Save failed'); }, { initial: existing, draft: null }); form.render();
  nodes(form.render(), n => n.props?.accessibilityLabel === 'Your stay tip')[0].props.onChangeText('Keep this tip');
  button(form, 'Done').onPress(); await flush(); assert.equal(form.saved, 0); assert.equal(form.stored.input.tip, 'Keep this tip');
  form.render().props.onClose(); assert.equal(form.closed, 0);
  assert.equal(form.alerts.at(-1)[2].map(a => a.text).join(','), 'Keep editing,Save draft,Discard changes');
});
