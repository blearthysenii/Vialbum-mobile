import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { SelectedPhoto } from '@/features/media/types';
import { normalizeDraft, requestId, type DraftPhoto, type JourneyDraft } from './draft';
import { resolvePhoto } from './library';
import { deleteWebPhotos, readWebPhoto, storeWebPhoto } from './webDraftPhotos';

const root = () => new Directory(Paths.document, 'journey-drafts');
const prefix = (userId: string) => `vialbum.journey-draft.${userId}.`;
function directory(userId: string) {
  const dir = new Directory(root(), userId);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}
function parse(text: string): JourneyDraft {
  const value = JSON.parse(text) as JourneyDraft;
  if (value.version !== 1 || !Array.isArray(value.photos) || !value.values || !/^[a-f0-9-]{36}$/i.test(value.requestId)) throw new Error('This draft could not be opened.');
  return normalizeDraft(value);
}
export function listDrafts(userId: string): JourneyDraft[] {
  const results: JourneyDraft[] = [];
  if (Platform.OS === 'web') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith(prefix(userId))) results.push(parse(localStorage.getItem(key)!));
    }
  } else {
    const dir = directory(userId);
    // Migrate the previous single-draft manifest without losing its durable photos.
    const legacy = new File(dir, 'draft.json');
    if (legacy.exists) { const value = parse(legacy.textSync()); saveDraft(userId, value); legacy.delete(); }
    const manifests = dir.list().filter((file): file is File => file instanceof File && file.name.endsWith('.json'));
    for (const file of manifests) results.push(parse(file.textSync()));
    for (const file of dir.list()) {
      if (!(file instanceof File) || !file.name.endsWith('.tmp')) continue;
      try {
        const value = parse(file.textSync());
        if (!results.some(item => item.requestId === value.requestId)) results.push(value);
      } catch { /* An interrupted temporary write does not replace a valid manifest. */ }
    }
  }
  return results.filter(item => !item.completed).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}
export function loadDraft(userId: string, id: string): JourneyDraft {
  const draft = listDrafts(userId).find(item => item.requestId === id);
  if (!draft) throw new Error('This draft is no longer available.');
  return draft;
}
export function saveDraft(userId: string, draft: JourneyDraft) {
  const value = { ...draft, updatedAt: new Date().toISOString() };
  if (Platform.OS === 'web') { localStorage.setItem(prefix(userId) + draft.requestId, JSON.stringify(value)); return; }
  const dir = directory(userId);
  const temporary = new File(dir, `${draft.requestId}.tmp`);
  temporary.write(JSON.stringify(value));
  temporary.moveSync(new File(dir, `${draft.requestId}.json`), { overwrite: true });
}
export async function keepPhoto(userId: string, photo: SelectedPhoto): Promise<DraftPhoto> {
  const source = await resolvePhoto(photo);
  const id = photo.requestId ?? requestId();
  if (Platform.OS === 'web') {
    await storeWebPhoto(`${userId}:${id}`, source.uri);
    return { ...source, requestId: id, caption: '', place: null, needsImport: false };
  }
  const extension = source.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const destination = new File(directory(userId), `${id}.${extension}`);
  if (source.uri !== destination.uri) await new File(source.uri).copy(destination, { overwrite: true });
  return { ...source, uri: destination.uri, requestId: id, caption: '', place: null, needsImport: false };
}
export async function restoreDraft(userId: string, id: string) {
  const draft = loadDraft(userId, id);
  const photos = await Promise.all(draft.photos.map(async photo => {
    if (photo.needsImport && photo.libraryId && photo.uri.startsWith('ph://')) return photo;
    if (Platform.OS === 'web') {
      const uri = await readWebPhoto(`${userId}:${photo.requestId}`).catch(() => null);
      return { ...photo, uri: uri ?? photo.uri, unavailable: !uri };
    }
    const exists = photo.uri.startsWith('file://') && new File(photo.uri).exists;
    return { ...photo, unavailable: !exists };
  }));
  return normalizeDraft({ ...draft, photos });
}
export async function clearDraft(userId: string, draft: JourneyDraft) {
  if (Platform.OS === 'web') {
    await deleteWebPhotos(draft.photos.map(photo => `${userId}:${photo.requestId}`));
    localStorage.removeItem(prefix(userId) + draft.requestId);
    return;
  }
  const dir = directory(userId);
  for (const photo of draft.photos) {
    if (photo.uri.startsWith(dir.uri + '/')) { const file = new File(photo.uri); if (file.exists) file.delete(); }
  }
  for (const suffix of ['json', 'tmp']) { const file = new File(dir, `${draft.requestId}.${suffix}`); if (file.exists) file.delete(); }
}
export async function clearJourneyDrafts() {
  if (Platform.OS === 'web') {
    await deleteWebPhotos();
    Object.keys(localStorage).filter(key => key.startsWith('vialbum.journey-draft.')).forEach(key => localStorage.removeItem(key));
  } else { const dir = root(); if (dir.exists) dir.delete(); }
}
