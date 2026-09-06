const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function load(source, mocks) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleValue = { exports: {} };
  vm.runInNewContext(output, {
    module: moduleValue,
    exports: moduleValue.exports,
    require: (name) => mocks[name],
  });
  return moduleValue.exports;
}

test('prepares journey data in parallel, prefetches its cover, and reuses the cache', async () => {
  const calls = [];
  const journey = { id: 'journey-1', cover_media_url: 'https://example.test/cover.jpg' };
  const memories = [{ id: 'memory-1' }];
  const media = [{ id: 'photo-1' }];
  const cache = load(fs.readFileSync('src/features/journeys/detailsCache.ts', 'utf8'), {
    'expo-image': { Image: { prefetch: async (url, policy) => { calls.push(['cover', url, policy]); return true; } } },
    '@/features/journeys/api': { journeyApi: { fetchJourney: async () => { calls.push(['journey']); return journey; } } },
    '@/features/media/api': { mediaApi: { list: async () => { calls.push(['media']); return media; } } },
    '@/features/memories/api': { memoryApi: { list: async () => { calls.push(['memories']); return memories; } } },
    '@/features/journeys/types': {},
    '@/features/media/types': {},
    '@/features/memories/types': {},
  });

  const prepared = await cache.prepareJourneyDetails('journey-1', journey);
  assert.equal(prepared.journey, journey);
  assert.equal(prepared.memories, memories);
  assert.equal(prepared.media, media);
  assert.ok(calls.some(([name]) => name === 'journey'));
  assert.ok(calls.some(([name]) => name === 'memories'));
  assert.ok(calls.some(([name]) => name === 'media'));
  assert.ok(calls.some(([name, , policy]) => name === 'cover' && policy === 'memory-disk'));

  const callCount = calls.length;
  const cached = await cache.prepareJourneyDetails('journey-1');
  assert.equal(cached.journey, journey);
  assert.equal(cached.memories, memories);
  assert.equal(cached.media, media);
  assert.equal(calls.length, callCount);
});
