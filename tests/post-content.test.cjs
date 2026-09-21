const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/posts/content.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: moduleValue, exports: moduleValue.exports });
const { postContent } = moduleValue.exports;
const journey = { description: ' Album story\n\nSecond paragraph. ', photos: [
  { id: 'one', memory_id: 'm', caption: 'Courtyard after Maghrib' },
  { id: 'two', memory_id: null, caption: 'Evening light' },
] };

test('swipe selects active caption and keeps complete journey description stable', () => {
  assert.equal(postContent(journey, 0).photoCaption, 'Courtyard after Maghrib');
  assert.equal(postContent(journey, 1).photoCaption, 'Evening light');
  for (const index of [0, 1]) assert.equal(postContent(journey, index).journeyDescription, journey.description.trim());
});
test('caption is visible without inspecting memory text or deduplicating it', () => {
  const input = { ...journey, photos: [journey.photos[0]], get memories() { throw Error('Memory must not be read'); } };
  assert.equal(postContent(input, 0).photoCaption, journey.photos[0].caption);
  assert.equal(postContent(input, 0, 'm').photoCaption, journey.photos[0].caption);
  assert.equal('memory' in postContent(input, 0), false);
});
test('old links scope photos without loading memory data', () => {
  const result = postContent(journey, 0, 'm');
  assert.equal(result.photos.length, 1); assert.equal(result.photo.id, 'one');
  const missing = postContent(journey, 0, 'removed');
  assert.equal(missing.photos.length, 0); assert.equal(missing.photoCaption, null);
});
test('blank fields do not produce fallback text', () => {
  const result = postContent({ title: 'Not a caption', description: ' \n ', photos: [{ caption: '  ' }] }, 0);
  assert.equal(result.photoCaption, null); assert.equal(result.journeyDescription, null);
  assert.equal(postContent({ photos: [], description: null }, 0).photoCaption, null);
});
test('long captions retain paragraphs without deduplication against journey description', () => {
  const text = ('Long paragraph. '.repeat(100) + '\n\n').repeat(3).trim();
  const result = postContent({ photos: [{ caption: text }], description: text }, 0);
  assert.equal(result.photoCaption, text); assert.equal(result.journeyDescription, text);
});
