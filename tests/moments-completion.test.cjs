const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, requireOverride = require, intl = Intl) {
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(requireOverride), Date, Intl: intl, Number, setTimeout, clearTimeout });
 return module.exports;
}
const { journeyDateRange } = load('src/features/moments/completionDates.ts');
test('completion dates are human-readable, locale-aware and stable across timezones', () => {
 const value = journeyDateRange('2026-09-18', '2026-09-21', 'en-GB');
 assert.match(value, /18/); assert.match(value, /21/); assert.match(value, /SEPT? 2026/); assert.ok(!value.includes('2026-09'));
 assert.notEqual(value, journeyDateRange('2026-09-18', '2026-09-21', 'de-DE'));
 assert.equal(journeyDateRange('', 'bad'), '');
});
test('native final video does not loop or signal completion until its real end; listeners clean up', async () => {
 const listeners = new Map(); const cleanups = []; let ended = 0;
 const player = { duration: 47, currentTime: 0, playing: true, pause() { this.playing = false; }, replay() {}, seekBy() {}, replaceAsync: async () => {}, addListener(name, fn) { listeners.set(name, fn); return { remove() { listeners.delete(name); } }; } };
 const hooks = { useState: value => [value, () => {}], useRef: value => ({ current: value }), useEffect: fn => { const clean = fn(); if (clean) cleanups.push(clean); }, useLayoutEffect: fn => { const clean = fn(); if (clean) cleanups.push(clean); } };
 const { NativePlayer } = load('src/features/moments/NativePlayer.tsx', name => {
  if (name === 'expo-video') return { useVideoPlayer: (_, setup) => { setup(player); return player; }, VideoView: 'VideoView' };
  if (name === 'react') return hooks;
  if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
  if (name === 'react-native') return { StyleSheet: { absoluteFill: {} }, View: 'View', ActivityIndicator: 'ActivityIndicator' };
  return require(name);
 });
 NativePlayer({ id: 'final', uri: 'video', active: true, loop: false, onEnd: () => ended++, gate: { register: () => () => {}, refresh() {}, intendsToPlay: () => true } });
 await Promise.resolve(); assert.equal(player.loop, false); assert.equal(ended, 0);
 listeners.get('timeUpdate')({ currentTime: 46.9 }); assert.equal(ended, 0);
 listeners.get('playToEnd')(); assert.equal(ended, 1);
 const staleEnd = listeners.get('playToEnd'); cleanups.reverse().forEach(fn => fn());
 assert.equal(listeners.size, 0); staleEnd(); assert.equal(ended, 1); assert.equal(player.playbackRate, 1);
});

test('completion dates work on iPhone Hermes without formatRange', () => {
 const compatible = { DateTimeFormat: function (...args) { const formatter = new Intl.DateTimeFormat(...args); formatter.formatRange = undefined; return formatter; } };
 const { journeyDateRange: fallback } = load('src/features/moments/completionDates.ts', require, compatible);
 assert.equal(fallback('2026-09-18', '2026-09-21', 'en-GB'), '18 — 21 SEPT 2026');
 assert.match(fallback('2026-09-18', '2026-10-02', 'en-GB'), /OCT 2026/);
});
