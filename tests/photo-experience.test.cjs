const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, modules = {}, globals = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => modules[name], ...globals });
  return mod.exports;
}
const { heroGeometry } = load('src/features/media/viewerGeometry.ts');
const { photoCoordinate, photoDay } = load('src/features/media/photoContext.ts');
test('hero starts at the measured crop and ends at the fitted photo without stretching pixels', () => {
  const viewport = { width: 400, height: 800 };
  const origin = { x: 20, y: 100, width: 360, height: 450, radius: 22 };
  for (const frame of [{ width: 400, height: 200 }, { width: 200, height: 800 }, { width: 400, height: 400 }]) {
    const start = heroGeometry(frame, viewport, origin, 0);
    assert.equal(start.width, 360); assert.equal(start.height, 450);
    assert.equal(start.x + viewport.width / 2 - start.width / 2, 20);
    assert.equal(start.y + viewport.height / 2 - start.height / 2, 100);
    assert.ok(frame.width * start.imageScale >= start.width);
    assert.ok(frame.height * start.imageScale >= start.height);
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const state = heroGeometry(frame, viewport, origin, progress);
      assert.equal((frame.width * state.imageScale) / (frame.height * state.imageScale), frame.width / frame.height);
    }
    const end = heroGeometry(frame, viewport, origin, 1);
    assert.equal(end.width, frame.width); assert.equal(end.height, frame.height);
    assert.equal(end.x + 0, 0); assert.equal(end.y + 0, 0); assert.equal(end.imageScale, 1); assert.equal(end.radius, 0);
  }
});
test('photo coordinates validate pairs, support zero, and fall back to place location', () => {
  assert.equal(photoCoordinate({ latitude: '', longitude: '', place: null }), null);
  assert.equal(photoCoordinate({ latitude: '91', longitude: '0', place: null }), null);
  const zero = photoCoordinate({ latitude: '0', longitude: '0', place: null });
  assert.equal(zero.latitude, 0); assert.equal(zero.longitude, 0);
  const fallback = photoCoordinate({ latitude: '10', longitude: null, place: { latitude: '30', longitude: '40' } });
  assert.equal(fallback.latitude, 30); assert.equal(fallback.longitude, 40);
  const precise = photoCoordinate({ latitude: '12.3', longitude: '45.6', place: { latitude: '30', longitude: '40' } });
  assert.equal(precise.latitude, 12.3);
});
test('day context respects calendar dates without inventing metadata', () => {
  assert.equal(photoDay({ captured_at: null }, '2026-09-18'), null);
  assert.equal(photoDay({ captured_at: 'invalid' }, '2026-09-18'), null);
  assert.equal(photoDay({ captured_at: '2026-09-18T22:00:00Z' }, '2026-09-18'), 'Day 1');
  assert.equal(photoDay({ captured_at: '2026-09-19T01:00:00Z' }, '2026-09-18'), 'Day 2');
});
test('controls hide after inactivity, stay visible through interaction, and reveal on tap', () => {
  let timer, visible = true;
  const cleanups = [];
  const { useViewerChrome } = load('src/features/media/useViewerChrome.ts', {
    react: { useState: value => [value, next => { visible = next; }], useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: fn => cleanups.push(fn()) },
    'react-native': { AccessibilityInfo: { isScreenReaderEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) } },
    'react-native-reanimated': { useSharedValue: value => ({ get: () => value, set: next => { value = next; } }), withTiming: value => value },
  }, { setTimeout: fn => { timer = fn; return 1; }, clearTimeout: () => { timer = null; } });
  const controls = useViewerChrome();
  timer(); assert.equal(visible, false); assert.equal(controls.opacity.get(), 0);
  controls.reveal(); assert.equal(visible, true); assert.equal(controls.opacity.get(), 1);
  controls.interaction(true); assert.equal(timer, null);
  controls.interaction(false); assert.equal(typeof timer, 'function');
  cleanups.forEach(fn => fn()); assert.equal(timer, null);
});
