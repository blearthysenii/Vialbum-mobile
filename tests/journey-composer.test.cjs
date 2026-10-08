const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, modules = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => name === './stops' ? load('src/features/journeys/stops.ts') : name === '@/features/media/videoEdit' ? load('src/features/media/videoEdit.ts') : modules[name] });
  return mod.exports;
}
const draftModule = load('src/features/journeys/draft.ts');
const { newJourneyDraft, movePhoto, removeDraftPhoto, detailsError } = draftModule;
const { publishDraft } = load('src/features/journeys/publishDraft.ts', { './draft': draftModule, './api': {}, '@/features/media/api': {} });
function draft() {
  return { ...newJourneyDraft(), values: { ...newJourneyDraft().values, title: 'Paris', destination: 'Paris', country: 'France', description: 'The whole trip', visibility: 'public' }, coverKey: 'b',
    photos: ['a', 'b'].map(key => ({ key, requestId: key, uri: key, name: key, mimeType: 'image/jpeg', caption: `Caption ${key}`, place: null })) };
}
function fakeApi() {
  let next = 0;
  const remote = new Map(), order = [], calls = [], requests = new Map();
  const api = {
    journeys: { createJourney: async input => { calls.push(['create', input]); return { id: 'journey' }; }, updateJourney: async (id, input) => { calls.push(['journey', input]); return { id }; } },
    media: {
      upload: async (id, photo, progress) => { const mediaId = requests.get(photo.requestId) ?? String(++next); requests.set(photo.requestId, mediaId); remote.set(mediaId, { id: mediaId }); progress(100); calls.push(['upload', photo.key]); return { id: mediaId }; },
      update: async (id, mediaId, input) => { order.push({ mediaId, ...input }); calls.push(['metadata', mediaId]); },
      list: async () => [...remote.values()],
      remove: async (id, mediaId) => { remote.delete(mediaId); calls.push(['remove', mediaId]); },
      setCover: async (id, mediaId) => { calls.push(['cover', mediaId]); },
    },
  };
  return { api, remote, order, calls };
}
test('photo captions and cover remain attached to identity through reorder and removal', () => {
  const current = draft();
  current.photos = movePhoto(current.photos, 'b', -1);
  assert.equal(current.photos[0].caption, 'Caption b');
  assert.equal(current.photos[1].caption, 'Caption a');
  assert.equal(current.values.description, 'The whole trip');
  const removed = removeDraftPhoto(current, 'b');
  assert.equal(removed.coverKey, 'a');
  assert.equal(removed.photos[0].caption, 'Caption a');
  assert.equal(removeDraftPhoto(removed, 'a').coverKey, null);
});
test('details validation rejects missing fields and reversed dates', () => {
  assert.ok(detailsError(newJourneyDraft().values));
  assert.ok(detailsError({ ...draft().values, start_date: '2026-09-29', end_date: '2026-09-28' }));
  assert.equal(detailsError(draft().values), null);
});
test('publishes separate captions, explicit order and cover before public visibility', async () => {
  const { api, calls, order } = fakeApi();
  const checkpoints = [], progress = [];
  await publishDraft(draft(), next => checkpoints.push(next), (label, percent) => progress.push(percent), api);
  assert.equal(calls[0][1].visibility, 'private');
  assert.equal(order[0].caption, 'Caption a');
  assert.equal(order[1].caption, 'Caption b');
  assert.equal(order[0].sort_order, 0);
  assert.equal(order[1].sort_order, 1);
  assert.deepEqual(calls.at(-2), ['cover', '2']);
  assert.equal(calls.at(-1)[0], 'journey');
  assert.equal(calls.at(-1)[1].visibility, 'public');
  assert.equal(checkpoints.at(-1).photos[1].mediaId, '2');
  assert.equal(progress.at(-1), 100);
});
test('failed upload keeps checkpoint and retry skips successful photos', async () => {
  const { api, calls, remote } = fakeApi();
  let saved = draft();
  const upload = api.media.upload;
  let fail = true;
  api.media.upload = async (...args) => { if (args[1].key === 'b' && fail) throw Error('Offline'); return upload(...args); };
  await assert.rejects(publishDraft(saved, next => saved = next, () => {}, api), /Offline/);
  assert.equal(saved.photos[0].mediaId, '1');
  assert.equal(saved.photos[1].caption, 'Caption b');
  assert.equal(calls.some(call => call[0] === 'journey' && call[1].visibility === 'public'), false);
  fail = false;
  await publishDraft(saved, next => saved = next, () => {}, api);
  assert.equal(calls.filter(call => call[0] === 'create').length, 1);
  assert.equal(calls.filter(call => call[0] === 'upload' && call[1] === 'a').length, 1);
  assert.equal(remote.size, 2);
});
test('lost upload response is retried with the same key without a duplicate', async () => {
  const { api, remote } = fakeApi();
  let saved = draft(), fail = true;
  const upload = api.media.upload;
  api.media.upload = async (...args) => { const result = await upload(...args); if (fail) { fail = false; throw Error('Lost response'); } return result; };
  await assert.rejects(publishDraft(saved, next => saved = next, () => {}, api));
  await publishDraft(saved, next => saved = next, () => {}, api);
  assert.equal(remote.size, 2);
});
test('retry reconciles removed uploaded photos and applies updated captions/order', async () => {
  const { api, remote, order } = fakeApi();
  let saved = draft();
  const cover = api.media.setCover;
  api.media.setCover = async () => { throw Error('Offline at cover'); };
  await assert.rejects(publishDraft(saved, next => saved = next, () => {}, api));
  saved = removeDraftPhoto(saved, 'a'); saved.photos[0].caption = 'Edited on retry';
  api.media.setCover = cover;
  await publishDraft(saved, next => saved = next, () => {}, api);
  assert.equal(remote.size, 1);
  assert.equal(order.at(-1).caption, 'Edited on retry');
  assert.equal(order.at(-1).sort_order, 0);
});
test('rejects empty selection and captions over 100 characters before network writes', async () => {
  const { api, calls } = fakeApi();
  const current = draft(); current.photos[0].caption = 'a'.repeat(101);
  await assert.rejects(publishDraft(current, () => {}, () => {}, api), /100/);
  await assert.rejects(publishDraft({ ...current, photos: [] }, () => {}, () => {}, api), /at least one/);
  assert.equal(calls.length, 0);
});
