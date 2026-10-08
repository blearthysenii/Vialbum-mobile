const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function model(request, detail) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/features/posts/data.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: require('./appearance-test-adapter.cjs').wrap(name => name === '@/api/client' ? { apiRequest: request } : { discoverApi: { detail } }) });
  return module.exports;
}

test('public Post Detail uses authorized public detail and preserves saved state', async () => {
  const signal = new AbortController().signal;
  const result = { id: 'j', is_saved: true, memories: [], photos: [] };
  const data = model(() => { throw Error('private endpoint'); }, async (id, received) => { assert.equal(id, 'j'); assert.equal(received, signal); return result; });
  assert.equal(await data.loadPost('j', false, {}, signal), result);
});

test('own Post Detail uses owner endpoints, filters videos, propagates cancellation and real creator', async () => {
  const signal = new AbortController().signal;
  const calls = [];
  const data = model(async (path, options) => {
    calls.push(path); assert.equal(options.signal, signal); assert.equal(options.authenticated, true);
    if (path.endsWith('/media')) return [{ id: 'photo', type: 'photo' }, { id: 'video', type: 'video' }];
    if (path.endsWith('/memories')) throw Error('Post Detail must not request memories');
    return { id: 'j', title: '', description: null };
  }, () => { throw Error('public endpoint'); });
  const post = await data.loadPost('j', true, { id: 'owner', username: 'name', first_name: 'Real', last_name: 'Name', profile_photo_url: null }, signal);
  assert.equal(post.photo_count, 1); assert.equal('memories' in post, false);
  assert.equal(post.creator.display_name, 'Real Name'); assert.equal(post.creator.avatar_url, null);
  assert.equal(post.title, ''); assert.equal(post.description, null); assert.equal(calls.length, 2);
  const target = data.postTarget('j', true, 'memory');
  assert.equal(target.pathname, '/post/[id]'); assert.equal(target.params.scope, 'own'); assert.equal(target.params.memoryId, 'memory');
});

test('Home is restored and public entry routes retain compatibility with Post Detail', () => {
  const home = fs.readFileSync('src/features/discover/components/DiscoverFeed.tsx', 'utf8');
  assert.match(home, /masonry/); assert.match(home, /numColumns=\{2\}/);
  assert.match(home, /DiscoverJourneyCard journey=/); assert.match(home, /VialbumWordmark/);
  assert.doesNotMatch(home, /TravelPost|visibleIds/);
  const alias = fs.readFileSync('app/discover/journey/[id].tsx', 'utf8');
  assert.match(alias, /Redirect/); assert.match(alias, /scope: 'public'/);
  for (const path of ['src/features/explore/ExploreScreen.tsx', 'src/features/explore/PlaceExploreScreen.tsx', 'src/features/publicProfile/PublicJourneyCollection.tsx']) assert.match(fs.readFileSync(path, 'utf8'), /\/post\/\[id\]/);
  assert.match(fs.readFileSync('app/(tabs)/profile.tsx', 'utf8'), /pathname: '\/post\/\[id\]'/);
  assert.match(fs.readFileSync('app/journey/[id].tsx', 'utf8'), /scope: 'own'/);
  const content = fs.readFileSync('src/features/posts/PostContent.tsx', 'utf8');
  assert.doesNotMatch(content, /Read memory|numberOfLines=\{3\}/);
  assert.match(content, /PublicPhotoViewer/); assert.doesNotMatch(content, /<SaveJourneyButton|<View style=\{\[styles.thumbnail/);
  assert.match(fs.readFileSync('src/features/posts/PostMenu.tsx', 'utf8'), /Save Journey/);
  assert.doesNotMatch(content, />MEMORY<|memory\.title|memory\.caption/);
  assert.doesNotMatch(fs.readFileSync('src/features/posts/PostDetailScreen.tsx', 'utf8'), /MemoryEditor|requirePostMemory/);
});
