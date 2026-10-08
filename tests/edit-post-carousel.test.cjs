const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

async function mount(count, persistedPhotos) {
  const state = [], effects = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props: type === 'Uploader' && props.renderControls
    ? { ...props, children: props.renderControls({ onPress() {}, disabled: false }) }
    : props });
  const photos = persistedPhotos ?? Array.from({ length: count }, (_, index) => ({
    id: String(index), type: 'photo', url: `photo-${index}`, caption: `Caption ${index}`,
  }));
  const journey = { id: 'journey', title: 'Trip', destination: 'City', country: 'Country',
    start_date: '2026-09-01', end_date: '2026-09-02', cover_media_id: '0' };
  const mocks = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useRef: initial => ({ current: initial }),
      useEffect: effect => effects.push(effect),
    },
    './CoverPicker': { CoverPicker: 'CoverPicker' },
    './editReturn': { beginPostEdit() {}, markPostEditChanged() {} },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Alert: {}, Platform: { OS: 'ios' }, StyleSheet: { create: value => value },
      ...Object.fromEntries(['KeyboardAvoidingView', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name])) },
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    '@react-native-community/datetimepicker': { default: 'DatePicker' },
    'expo-image': { Image: 'Image' },
    'expo-router': { router: {}, useNavigation: () => ({}) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/features/journeys/components/JourneyVisibilityField': { JourneyVisibilityField: 'Visibility' },
    '@/features/journeys/JourneyProvider': { useJourneys: () => ({ fetchOne: async () => journey, setCover: async (_id, mediaId) => { journey.cover_media_id = mediaId; return { ...journey, cover_media_url: `photo-${mediaId}` }; } }) },
    '@/features/media/api': { mediaApi: {
      list: async () => photos,
      update: async (_journeyId, photoId, body) => {
        const index = photos.findIndex(photo => photo.id === photoId);
        photos[index] = { ...photos[index], ...body };
        return photos[index];
      },
    } },
    '@/features/media/components/PhotoUploader': { PhotoUploader: 'Uploader' },
    '@/features/media/imageUrl': { cachedImageSource: url => url },
    '@/features/places/components/LocationPicker': { LocationPicker: 'Location' },
    '@/features/profile/theme': { useProfileTheme: () => ({}) },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/features/posts/EditPostScreen.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout,
    require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], `Unexpected dependency: ${name}`); return mocks[name]; }) });
  const render = () => { cursor = 0; return module.exports.EditPostScreen({ id: 'journey' }); };
  render();
  effects[0]();
  effects[1]();
  await new Promise(resolve => setImmediate(resolve));
  return { render, photos };
}

function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const pager = tree => nodes(tree, node => node.type === 'ScrollView' && node.props.pagingEnabled)[0];

for (const count of [1, 2, 5]) {
  test(`${count} photos: first render, measured pages, swipe, thumbnail selection and reopen`, async () => {
    const { render } = await mount(count);
    let tree = render();
    assert.equal(pager(tree), undefined, 'never mount pages with an unmeasured width');
    const viewport = nodes(tree, node => node.props?.onLayout)[0];
    const preview = nodes(viewport, node => node.type === 'Image');
    assert.equal(preview.length, 1);
    assert.equal(preview[0].props.source, 'photo-0');
    assert.equal(preview[0].props.style.width, '100%');
    for (const width of [358, 398.5]) {
      viewport.props.onLayout({ nativeEvent: { layout: { width } } });
      tree = render();
      const carousel = pager(tree);
      assert.equal(carousel.props.contentInsetAdjustmentBehavior, 'never');
      assert.equal(carousel.props.automaticallyAdjustContentInsets, false);
      for (const page of carousel.props.children) assert.equal(page.props.style[1].width, width);
      for (const index of [...Array(count).keys(), ...Array(count).keys()].reverse()) {
        pager(tree).props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: index * width } } });
        tree = render();
        assert.equal(pager(tree).props.contentOffset.x, index * width);
        assert.equal(nodes(tree, node => node.props?.accessibilityLabel === 'Caption for this photo')[0].props.value, `Caption ${index}`);
      }
      nodes(tree, node => node.props?.accessibilityLabel === `Edit photo ${count}`)[0].props.onPress();
      tree = render();
      assert.equal(pager(tree).props.contentOffset.x, (count - 1) * width);
    }
    const reopened = await mount(count);
    tree = reopened.render();
    nodes(tree, node => node.props?.onLayout)[0].props.onLayout({ nativeEvent: { layout: { width: 358 } } });
    assert.equal(pager(reopened.render()).props.contentOffset.x, 0);
  });
}


test('caption edits enforce 100 characters, preserve newlines and save independently for each photo', async () => {
  const { render, photos } = await mount(2);
  const input = () => nodes(render(), node => node.props?.accessibilityLabel === 'Caption for this photo')[0].props;
  const select = number => nodes(render(), node => node.props?.accessibilityLabel === `Edit photo ${number}`)[0].props.onPress();
  const count = () => nodes(render(), node => node.type === 'Text' && Array.isArray(node.props.children) && node.props.children[1] === '/100')[0].props.children.join('');
  assert.equal(input().multiline, true);
  assert.equal(input().scrollEnabled, false);
  assert.equal(input().submitBehavior, 'newline');
  assert.equal(input().maxLength, 100);
  assert.equal(input().style.height, undefined);
  input().onChangeText('');
  assert.equal(count(), '0/100');
  input().onChangeText('a'.repeat(34));
  assert.equal(count(), '34/100');
  const caption = 'First line\nSecond line\n' + 'x'.repeat(100);
  input().onChangeText(caption);
  assert.equal(input().value, caption.slice(0, 100));
  assert.equal(count(), '100/100');
  select(2);
  assert.equal(input().value, 'Caption 1');
  input().onChangeText('Another photo\nAnother caption');
  select(1);
  assert.equal(input().value, caption.slice(0, 100));
  const save = nodes(render(), node => node.type === 'Pressable' && nodes(node.props.children,
    child => child.type === 'Text' && child.props.children === 'Save Changes').length)[0];
  assert.equal(save.props.disabled, false);
  save.props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(photos[0].caption, caption.slice(0, 100));
  assert.equal(photos[1].caption, 'Another photo\nAnother caption');
  const reopened = await mount(2, photos);
  const reopenedInput = () => nodes(reopened.render(), node => node.props?.accessibilityLabel === 'Caption for this photo')[0].props;
  assert.equal(reopenedInput().value, caption.slice(0, 100));
  nodes(reopened.render(), node => node.props?.accessibilityLabel === 'Edit photo 2')[0].props.onPress();
  assert.equal(reopenedInput().value, 'Another photo\nAnother caption');
});


test('cover Done persists without reordering or selecting a different carousel photo', async () => {
  const { render, photos } = await mount(5);
  const before = photos.map(photo => photo.id);
  const open = () => nodes(render(), node => node.props?.accessibilityLabel === 'Change journey cover')[0].props.onPress();
  const picker = () => nodes(render(), node => node.type === 'CoverPicker')[0];
  open();
  assert.equal(picker().props.coverId, '0');
  picker().props.onCancel();
  assert.equal(picker(), undefined);
  open();
  await picker().props.onConfirm('4');
  assert.equal(picker(), undefined);
  assert.deepEqual(photos.map(photo => photo.id), before);
  assert.equal(nodes(render(), node => node.props?.accessibilityLabel === 'Edit photo 1')[0].props.accessibilityState.selected, true);
  open();
  assert.equal(picker().props.coverId, '4');
});
