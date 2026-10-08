const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function mount(dark, legal = true) {
  const slots = [], pushes = [], alerts = [], logouts = [], replacements = [];
  let cursor = 0, backs = 0, deletions = 0;
  const theme = { ink: 'ink', muted: 'muted', subtle: 'subtle', danger: 'red', divider: 'divider', groupedCanvas: dark ? 'darkCanvas' : 'lightCanvas', groupedSurface: dark ? 'darkSurface' : 'lightSurface' };
  const mocks = {
    '@expo/vector-icons/Ionicons': { default: 'Icon' }, 'expo-constants': { default: { expoConfig: { version: '1' } } },
    'expo-router': { router: { push: path => pushes.push(path), back: () => backs++, replace: path => replacements.push(path) } },
    react: { useState: value => { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; }, useEffect: () => {}, useMemo: fn => fn() },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { ActivityIndicator: 'Spinner', Alert: { alert: (...args) => alerts.push(args) }, Linking: { openURL: async () => {} }, Pressable: 'Button', ScrollView: 'Scroll', StyleSheet: { create: v => v }, Text: 'Text', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'Safe' },
    '@/features/account/config': { accountLinks: { privacy: legal ? 'https://test/privacy' : null, terms: null }, validPublicUrl: value => Boolean(value) },
    '@/features/account/components/DeleteAccountSheet': { DeleteAccountSheet: 'DeleteSheet' },
    '@/features/auth/AuthProvider': { useAuth: () => ({ signOut: async value => logouts.push(value), deleteAccount: async () => deletions++ }) },
    '@/features/exports/api': { exportApi: { account: async () => {} } }, '@/features/exports/components/ExportProgress': { ExportProgress: 'Export' },
    '@/features/journeys/JourneyProvider': { useJourneys: () => ({ journeys: [] }) }, '@/features/memories/api': { memoryApi: { list: async () => [] } },
    '@/features/profile/components/TravelProfileContent': { TravelStatsCard: 'Stats' }, '@/features/profile/theme': { useProfileTheme: () => theme },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/settings.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => { assert.ok(mocks[name], name); return mocks[name]; }) });
  const render = () => { cursor = 0; return module.exports.default(); };
  const row = label => nodes(render(), n => n.props?.accessibilityLabel === label)[0]?.props;
  return { render, row, theme, pushes, alerts, logouts, replacements, get backs() { return backs; }, get deletions() { return deletions; } };
}
for (const dark of [false, true]) test(`Settings uses solid grouped surfaces and existing Saved navigation: dark=${dark}`, () => {
  const screen = mount(dark); const tree = screen.render();
  assert.equal(tree.props.style[1].backgroundColor, screen.theme.groupedCanvas);
  assert.ok(nodes(tree, n => n.type === 'View' && n.props.style?.[1]?.backgroundColor === screen.theme.groupedSurface).length >= 4);
  for (const label of ['Edit profile', 'Saved', 'Saved Moments', 'Drafts']) screen.row(label).onPress();
  assert.equal(screen.pushes.join(','), '/edit-profile,/saved-journeys,/saved-moments,/journey/drafts');
  screen.row('Back').onPress(); assert.equal(screen.backs, 1);
  for (const label of ['Notifications', 'Blocked accounts']) assert.equal(screen.row(label), undefined);
  assert.equal(screen.row('Version').disabled, true);
  screen.row('Appearance').onPress();
  for (const choice of ['System', 'Light', 'Dark']) assert.ok(screen.row(choice + ' appearance'));
  assert.equal(screen.row('System appearance').accessibilityState.checked, true);
});
test('Settings retains saved-account logout choices and confirmed deletion sheet', async () => {
  for (const save of [false, true]) {
    const screen = mount(false); screen.row('Log out').onPress(); assert.equal(screen.logouts.length, 0);
    screen.alerts[0][2].find(a => a.text === (save ? 'Save' : 'Don’t Save')).onPress();
    await new Promise(resolve => setImmediate(resolve)); assert.equal(screen.logouts[0], save); assert.equal(screen.replacements[0], '/sign-in');
  }
  const screen = mount(true); screen.row('Delete account').onPress(); assert.equal(screen.deletions, 0);
  const sheet = nodes(screen.render(), n => n.type === 'DeleteSheet')[0]; assert.equal(sheet.props.visible, true);
  await sheet.props.onDelete('password'); assert.equal(screen.deletions, 1);
});
test('Unconfigured legal links are omitted and owner Profile retains gear without Saved utilities', () => {
  const screen = mount(false, false); assert.equal(screen.row('Privacy Policy'), undefined); assert.equal(screen.row('Terms'), undefined);
  const source = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8');
  assert.doesNotMatch(source, /saved-journeys|saved-moments/); assert.match(source, /router.push\('\/settings'\)/);
  assert.doesNotMatch(fs.readFileSync('src/features/publicProfile/PublicProfileHeader.tsx', 'utf8'), /\/settings/);
});
