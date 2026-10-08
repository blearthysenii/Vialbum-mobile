const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const crypto = require('node:crypto');
const ts = require('typescript');
const baseline = require('./fixtures/appearance-baseline.json');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function harness({ stored = null, read, write, system = 'light' } = {}) {
  const cache = new Map(), nativeCalls = [], writes = [];
  let override = 'unspecified';
  const native = {
    Appearance: {
      getColorScheme: () => override === 'unspecified' ? system : override,
      setColorScheme: value => { nativeCalls.push(value); override = value; },
    },
    useColorScheme: () => native.Appearance.getColorScheme(),
    StyleSheet: { flatten: value => Object.assign({}, ...[value].flat(Infinity).filter(Boolean)) },
  };
  const react = { useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useMemo: fn => fn() };
  const secure = { getItemAsync: read ?? (async () => stored), setItemAsync: async (key, value) => { writes.push([key, value]); if (write) await write(key, value); stored = value; } };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync('src/theme/' + file + '.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require: name => name === 'react' ? react : name === 'react-native' ? native : name === 'expo-secure-store' ? secure : load(name.replace('./', '')) });
    cache.set(file, module.exports); return module.exports;
  }
  return { load, nativeCalls, writes, changeSystem: value => { system = value; }, stored: () => stored };
}
test('System is the default; native and React appearance follow system changes', async () => {
  const h = harness(), a = h.load('appearance');
  assert.equal(a.appearanceStore.getSnapshot().ready, false);
  await a.appearanceStore.restore();
  assert.deepEqual(h.nativeCalls, ['unspecified']);
  assert.equal(a.appearanceStore.getSnapshot().preference, 'system');
  assert.equal(a.useAppColorScheme(), 'light');
  h.changeSystem('dark'); assert.equal(a.useAppColorScheme(), 'dark');
  assert.equal(a.presentationInterfaceStyle(), 'dark');
});
test('stored explicit appearance restores before ready and survives system changes', async () => {
  for (const stored of ['light', 'dark']) {
    const h = harness({ stored, system: stored === 'light' ? 'dark' : 'light' }), a = h.load('appearance');
    await Promise.all([a.appearanceStore.restore(), a.appearanceStore.restore()]);
    assert.deepEqual(h.nativeCalls, [stored]);
    assert.equal(a.useAppColorScheme(), stored);
    h.changeSystem(stored === 'light' ? 'dark' : 'light'); assert.equal(a.useAppColorScheme(), stored);
  }
});
test('appearance changes are immediate, keep ready true, serialize persistence, and release subscribers', async () => {
  const h = harness(), a = h.load('appearance'); await a.appearanceStore.restore();
  const seen = [], release = a.appearanceStore.subscribe(() => seen.push(a.appearanceStore.getSnapshot().preference));
  const first = a.appearanceStore.set('dark');
  assert.equal(a.useAppColorScheme(), 'dark');
  const second = a.appearanceStore.set('light'), third = a.appearanceStore.set('system');
  assert.equal(a.appearanceStore.getSnapshot().ready, true);
  await Promise.all([first, second, third]);
  assert.deepEqual(h.writes.map(value => value[1]), ['dark', 'light', 'system']);
  assert.equal(h.stored(), 'system'); assert.deepEqual(seen, ['dark', 'light', 'system']);
  release(); await a.appearanceStore.set('dark'); assert.equal(seen.length, 3);
  const reopened = harness({ stored: h.stored() }).load('appearance'); await reopened.appearanceStore.restore(); assert.equal(reopened.useAppColorScheme(), 'dark');
});
test('failed storage falls back safely, failed writes report errors and later writes recover', async () => {
  const h = harness({ read: async () => { throw Error('locked'); }, write: async (_key, value) => { if (value === 'dark') throw Error('full'); } }), a = h.load('appearance');
  await a.appearanceStore.restore(); assert.equal(a.appearanceStore.getSnapshot().ready, true);
  await assert.rejects(a.appearanceStore.set('dark'), /full/); assert.equal(a.useAppColorScheme(), 'dark');
  await a.appearanceStore.set('light'); assert.equal(h.stored(), 'light');
});
test('late restoration cannot overwrite a newer selection', async () => {
  let resolve; const h = harness({ read: () => new Promise(done => { resolve = done; }) }), a = h.load('appearance');
  const restoring = a.appearanceStore.restore(); await a.appearanceStore.set('dark'); resolve('light'); await restoring;
  assert.equal(a.useAppColorScheme(), 'dark'); assert.deepEqual(h.nativeCalls, ['dark']);
});
test('legacy Light colors, style identity, geometry, and media colors are preserved; dark uses semantic surfaces', async () => {
  const h = harness(), a = h.load('appearance'), p = h.load('presentation'), tokens = h.load('palette').darkPalette;
  const light = { screen: { backgroundColor: '#FFFFFF', padding: 20 }, card: { backgroundColor: '#F8F8F7', borderRadius: 22, shadowOpacity: .14 }, input: { backgroundColor: '#E8E3D8', color: '#171713' }, skeleton: { backgroundColor: '#EEEDEA' }, label: { color: '#111111' }, meta: { color: '#777773' }, border: { borderColor: '#DFDCD3', borderWidth: .5 }, player: { backgroundColor: '#000000' }, overlay: { color: '#FFFFFF' } };
  await a.appearanceStore.restore(); assert.equal(p.usePresentationStyles(light), light);
  const frozen = JSON.stringify(light); await a.appearanceStore.set('dark'); const dark = p.usePresentationStyles(light);
  assert.equal(dark.screen.backgroundColor, tokens.canvas); assert.equal(dark.card.backgroundColor, tokens.surface); assert.equal(dark.input.backgroundColor, tokens.control); assert.equal(dark.input.color, tokens.ink); assert.equal(dark.label.color, tokens.ink); assert.equal(dark.meta.color, tokens.muted); assert.equal(dark.border.borderColor, tokens.border); assert.equal(dark.skeleton.backgroundColor, tokens.control);
  assert.equal(dark.player.backgroundColor, '#000000'); assert.equal(dark.overlay.color, '#FFFFFF'); assert.equal(dark.card.borderRadius, 22); assert.equal(dark.card.shadowOpacity, .14); assert.equal(dark.screen.padding, 20); assert.equal(JSON.stringify(light), frozen);
  assert.equal(p.presentationTextStyle(), p.presentationTextStyle());
  assert.equal(p.presentationTextStyle().color, tokens.ink);
  const explicit = { color: '#FFFFFF' }; assert.equal(p.presentationTextStyle(explicit), explicit);
  assert.equal(p.resolvePresentationColor('#F5E9E4', 'backgroundColor', 'surface'), tokens.errorSurface);
  assert.equal(p.resolvePresentationColor('#007AFF', 'backgroundColor', 'control'), tokens.accentFill);
  assert.equal(p.resolvePresentationColor('#007AFF', 'color'), tokens.accent);
  assert.equal(p.resolvePresentationColor('#2F95FF', 'backgroundColor', 'surface'), '#2F95FF');
  assert.equal(p.resolvePresentationColor('transparent', 'backgroundColor'), 'transparent');
  assert.equal(p.presentationBlurTint('systemMaterialLight'), 'systemMaterialDark');
  assert.equal(p.presentationInterfaceStyle(), 'dark');
  await a.appearanceStore.set('light'); assert.equal(p.usePresentationStyles(light), light); assert.equal(p.presentationBlurTint('systemMaterialLight'), 'systemMaterialLight');
});
test('protected image, store, provider, pagination and native configuration files remain byte-identical', () => {
  for (const [file, expected] of Object.entries(baseline.protectedFiles)) assert.equal(hash(fs.readFileSync(file)), expected, file);
});
test('all pre-existing Light StyleSheet definitions and static Light palettes remain unchanged', () => {
  for (const [file, expected] of Object.entries(baseline.lightStyles)) {
    const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), actual = [];
    function visit(n) { if (ts.isCallExpression(n) && n.expression.getText(ast) === 'StyleSheet.create') actual.push(hash(n.getText(ast))); ts.forEachChild(n, visit); } visit(ast);
    assert.deepEqual(actual, expected, file);
  }
  for (const [file, expected] of Object.entries(baseline.lightPalettes)) {
    const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const d of statement.declarationList.declarations) if (d.name.getText(ast).includes('LightColors')) assert.equal(hash(d.initializer.getText(ast)), expected, file);
  }
});
test('appearance updates cannot replace navigator/provider/list keys or own Profile content identities', () => {
  const root = fs.readFileSync('app/_layout.tsx', 'utf8'), profile = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8');
  assert.match(root, /ready \? <AuthProvider><JourneyProvider><RootNavigator/);
  for (const file of ['app/_layout.tsx', 'app/(tabs)/_layout.tsx', 'app/(tabs)/profile.tsx']) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /key=\{[^}]*\b(?:theme|dark|colorScheme|preference)\b/);
  assert.match(profile, /<ProfileGridList key=\{user.id\}/); assert.match(profile, /keyCell = useCallback\(\(item: Cell\) => `\$\{item.kind\}:\$\{item.value.id\}`/);
  assert.equal((profile.match(/<ProfileGridList\b/g) ?? []).length, 1);
  assert.match(profile, /\[width, theme.placeholder, openJourney, userId, refreshJourneyImage, refreshMomentImage, journeyImageDisplayed, momentImageDisplayed\]/);
});
test('Profile Light theme branches and non-presentation lifecycle hooks remain unchanged', () => {
  const text = fs.readFileSync('src/features/profile/theme.ts', 'utf8'), ast = ts.createSourceFile('theme.ts', text, ts.ScriptTarget.Latest, true), light = [];
  function visit(n) { if (ts.isConditionalExpression(n) && n.condition.getText(ast) === 'dark') light.push(hash(n.whenFalse.getText(ast))); ts.forEachChild(n, visit); } visit(ast);
  assert.deepEqual(light, baseline.lightProfileBranches);
  const source = fs.readFileSync('app/(tabs)/profile.tsx', 'utf8'), tree = ts.createSourceFile('profile.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), lifecycle = [];
  function walk(n) { if (ts.isCallExpression(n) && ['useEffect', 'useFocusEffect', 'useMemo', 'useCallback'].includes(n.expression.getText(tree)) && !/[<>]/.test(n.getText(tree).replace(/=>/g, ''))) lifecycle.push(hash(n.getText(tree))); ts.forEachChild(n, walk); } walk(tree);
  assert.deepEqual(lifecycle, baseline.profileLifecycle);
});
test('dark text, placeholders, links, errors and brand-button labels have readable contrast', () => {
  const p = harness().load('palette').darkPalette;
  const luminance = hex => {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  for (const background of [p.canvas, p.surface, p.control]) for (const foreground of [p.ink, p.muted, p.placeholder, p.accent, p.danger]) assert.ok(ratio(foreground, background) >= 4.5, `${foreground} on ${background}`);
  assert.ok(ratio('#FFFFFF', p.accentFill) >= 4.5);
});
test('native map snapshot refresh keeps its marker reference and runs only when appearance changes', () => {
  let scheme = 'light', previous, cleanup, redraws = 0, nextFrame = 0;
  const frames = new Map(), ref = { current: { redraw: () => redraws++ } }, module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/theme/useThemedMarker.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => name === 'react' ? {
      useRef: () => ref,
      useEffect: (fn, deps) => { if (!previous || deps[0] !== previous[0]) { cleanup?.(); cleanup = fn(); previous = deps; } },
    } : { useAppColorScheme: () => scheme },
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); };
  assert.equal(module.exports.useThemedMarker(), ref); flush(); assert.equal(redraws, 1);
  assert.equal(module.exports.useThemedMarker(), ref); flush(); assert.equal(redraws, 1);
  scheme = 'dark'; assert.equal(module.exports.useThemedMarker(), ref); flush(); assert.equal(redraws, 2);
  scheme = 'light'; module.exports.useThemedMarker(); cleanup(); flush(); assert.equal(redraws, 2);
});
