const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, Error, require: key => key === './stops' ? load('src/features/journeys/stops.ts') : mocks[key] });
  return module.exports;
}
const draft = load('src/features/journeys/draft.ts');
function storage() {
  const files = new Map(), directories = new Set();
  const uri = parts => parts.map(part => typeof part === 'string' ? part : part.uri).join('/');
  class File {
    constructor(...parts) { this.uri = uri(parts); }
    get name() { return this.uri.split('/').at(-1); }
    get exists() { return files.has(this.uri); }
    textSync() { return files.get(this.uri); }
    write(text) { files.set(this.uri, text); }
    moveSync(destination, options) { if (destination.exists && !options.overwrite) throw Error('File exists'); files.set(destination.uri, files.get(this.uri)); files.delete(this.uri); this.uri = destination.uri; }
    async copy(destination) { if (!this.exists) throw Error('Missing photo'); files.set(destination.uri, files.get(this.uri)); }
    delete() { files.delete(this.uri); }
  }
  class Directory {
    constructor(...parts) { this.uri = uri(parts); }
    get exists() { return directories.has(this.uri); }
    create() { directories.add(this.uri); }
    list() { return [...files.keys()].filter(key => key.slice(0, key.lastIndexOf('/')) === this.uri).map(key => new File(key)); }
    delete() { for (const key of files.keys()) if (key.startsWith(this.uri + '/')) files.delete(key); directories.delete(this.uri); }
  }
  return { files, api: load('src/features/journeys/draftStorage.ts', { 'expo-file-system': { File, Directory, Paths: { document: 'file:///documents' } }, 'react-native': { Platform: { OS: 'ios' } }, './draft': draft, './library': { resolvePhoto: async photo => photo }, './webDraftPhotos': {} }) };
}
test('multiple drafts are independent, keep captions and cover, and account scopes are separate', async () => {
  const { api } = storage(); const first = draft.newJourneyDraft(), second = draft.newJourneyDraft();
  first.values.title = 'First'; second.values.title = 'Second';
  api.saveDraft('owner', first); api.saveDraft('owner', second); api.saveDraft('other', first);
  assert.equal(api.listDrafts('owner').length, 2);
  assert.equal(api.loadDraft('owner', first.requestId).values.title, 'First');
  await api.clearDraft('owner', first);
  assert.equal(api.listDrafts('owner').length, 1);
  assert.equal(api.listDrafts('other').length, 1);
});
test('legacy single draft migrates with its existing retry identity', () => {
  const { api, files } = storage(); const previous = draft.newJourneyDraft(); previous.values.title = 'Legacy';
  files.set('file:///documents/journey-drafts/owner/draft.json', JSON.stringify(previous));
  assert.equal(api.listDrafts('owner')[0].requestId, previous.requestId);
  assert.equal(files.has('file:///documents/journey-drafts/owner/draft.json'), false);
  assert.equal(api.listDrafts('owner').length, 1);
});
test('restoring a missing photo retains its identity, caption and cover for replacement', async () => {
  const { api } = storage(); const value = draft.newJourneyDraft();
  value.photos = [{ key: 'stable', requestId: 'photo-request', uri: 'file:///missing.jpg', name: 'missing.jpg', mimeType: 'image/jpeg', caption: 'Keep this caption', place: null }]; value.coverKey = 'stable';
  api.saveDraft('owner', value);
  const restored = await api.restoreDraft('owner', value.requestId);
  assert.equal(restored.photos[0].unavailable, true);
  assert.equal(restored.photos[0].caption, 'Keep this caption');
  assert.equal(restored.coverKey, 'stable');
});
test('durable photo copy is awaited and only that draft’s file is removed', async () => {
  const { api, files } = storage(); files.set('file:///temporary.jpg', 'image bytes');
  const selected = await api.keepPhoto('owner', { key: 'a', uri: 'file:///temporary.jpg', name: 'photo.jpg', mimeType: 'image/jpeg' });
  assert.equal(files.get(selected.uri), 'image bytes'); assert.equal(selected.needsImport, false);
  const value = { ...draft.newJourneyDraft(), photos: [selected], coverKey: selected.key };
  api.saveDraft('owner', value);
  assert.equal((await api.restoreDraft('owner', value.requestId)).photos[0].unavailable, false);
  await api.clearDraft('owner', value);
  assert.equal(files.has(selected.uri), false); assert.equal(files.has('file:///temporary.jpg'), true);
});
test('completed drafts are not offered again and interrupted saves recover', () => {
  const { api, files } = storage(); const done = { ...draft.newJourneyDraft(), completed: true };
  api.saveDraft('owner', done);
  assert.equal(api.listDrafts('owner').length, 0);
  const value = draft.newJourneyDraft(); files.set(`file:///documents/journey-drafts/owner/${value.requestId}.tmp`, JSON.stringify(value));
  assert.equal(api.listDrafts('owner')[0].requestId, value.requestId);
});
