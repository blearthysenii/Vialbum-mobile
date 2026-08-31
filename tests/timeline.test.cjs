const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Compile the pure utility with the project's existing TypeScript dependency.
// This keeps these tests runnable on Node 20 without a new test framework.
const source = readFileSync(path.join(__dirname, '../src/features/timeline/groupTimeline.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const context = { exports: {} };
vm.runInNewContext(compiled.outputText, context);
const { groupTimeline } = context.exports;
const memory = (id, date, created = `${date}T12:00:00Z`) => ({ id, memory_date: date, created_at: created });
const photo = (id, captured, created = '2025-03-15T10:00:00Z') => ({ id, type: 'photo', captured_at: captured, created_at: created });
const plain = (value) => JSON.parse(JSON.stringify(value));

test('groups chronologically, skips empty days, and derives Day N from journey start', () => {
  const sections = groupTimeline('2025-03-12', [memory('b', '2025-03-15'), memory('a', '2025-03-12')], []);
  assert.deepEqual(plain(sections.map(({ date, day }) => ({ date, day }))), [
    { date: '2025-03-12', day: 1 }, { date: '2025-03-15', day: 4 },
  ]);
  assert.equal(groupTimeline('2025-03-12', [], []).length, 0);
});

test('memories precede photos; each type sorts by time then UUID regardless of input order', () => {
  const memories = [memory('b', '2025-03-12'), memory('c', '2025-03-12', '2025-03-12T11:00:00Z'), memory('a', '2025-03-12')];
  const photos = [photo('z', '2025-03-12T08:00:00Z'), photo('x', '2025-03-12T07:00:00Z'), photo('y', '2025-03-12T08:00:00Z')];
  const ids = (m, p) => plain(groupTimeline('2025-03-12', m, p)[0].data.map((i) => i.id));
  assert.deepEqual(ids(memories, photos), ['c', 'a', 'b', 'x', 'y', 'z']);
  assert.deepEqual(ids([...memories].reverse(), [...photos].reverse()), ['c', 'a', 'b', 'x', 'y', 'z']);
  assert.deepEqual(memories.map((i) => i.id), ['b', 'c', 'a']);
  assert.deepEqual(photos.map((i) => i.id), ['z', 'x', 'y']);
});

test('photo day preserves metadata date even when its UTC date differs', () => {
  const sections = groupTimeline('2025-03-12', [], [photo('a', '2025-03-12T00:30:00+14:00'), photo('b', '2025-03-12T23:30:00-08:00')]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].date, '2025-03-12');
  assert.equal(sections[0].data.length, 2);
});

test('missing or invalid capture metadata falls back to upload date, then journey start', () => {
  const sections = groupTimeline('2025-03-12', [], [photo('a', null), photo('b', 'invalid'), photo('c', null, 'invalid'), photo('d', '2025-02-30T10:00:00Z')]);
  assert.deepEqual(plain(sections.map((s) => [s.date, s.data.map((i) => i.id)])), [
    ['2025-03-12', ['c']], ['2025-03-15', ['a', 'b', 'd']],
  ]);
});

test('calendar day numbering survives DST, year boundaries, and leap days', () => {
  for (const [start, end, expected] of [['2025-03-08', '2025-03-10', 3], ['2025-12-31', '2026-01-01', 2], ['2024-02-28', '2024-03-01', 3]]) {
    assert.equal(groupTimeline(start, [memory('a', end)], [])[0].day, expected);
  }
});

test('timezone-free EXIF timestamps sort consistently with explicit timestamps', () => {
  const sections = groupTimeline('2025-03-12', [], [photo('b', '2025-03-12T12:00:00'), photo('a', '2025-03-12T11:00:00Z')]);
  assert.deepEqual(plain(sections[0].data.map((i) => i.id)), ['a', 'b']);
});

test('keeps distinct memory/photo identities, omits videos, and retains out-of-range dates', () => {
  const sections = groupTimeline('2025-03-12', [memory('same', '2025-03-11')], [photo('same', '2025-03-11T12:00:00Z'), { ...photo('video', null), type: 'video' }]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].day, 0);
  assert.deepEqual(plain(sections[0].data.map((i) => `${i.type}:${i.id}`)), ['memory:same', 'photo:same']);
});
