import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { requestId } from '@/features/journeys/draft';
import type { SelectedPhoto } from '@/features/media/types';
import { resolvePhoto } from '@/features/journeys/library';
import type { StayInput, StayPhoto } from './api';
export type EditorPhoto = { key: string; uri: string; name: string; mimeType: string; request_id: string; server?: StayPhoto; replace_id?: string };
export type EditorDraft = { request_id: string; recommendationId?: string; input: StayInput & { name?: string }; photos: EditorPhoto[]; removed: string[] };
const folder = (owner: string, journey: string) => new Directory(Paths.document, 'stay-drafts', owner, journey);
export function loadStayDraft(owner: string, journey: string): EditorDraft | null {
  if (Platform.OS === 'web') { const value = localStorage.getItem(`stay-draft:${owner}:${journey}`); return value ? JSON.parse(value) : null; }
  const file = new File(folder(owner, journey), 'draft.json'); return file.exists ? JSON.parse(file.textSync()) : null;
}
export function storeStayDraft(owner: string, journey: string, draft: EditorDraft) {
  if (Platform.OS === 'web') { localStorage.setItem(`stay-draft:${owner}:${journey}`, JSON.stringify(draft)); return; }
  const directory = folder(owner, journey); directory.create({ intermediates: true, idempotent: true });
  const temporary = new File(directory, 'draft.tmp'); temporary.write(JSON.stringify(draft)); temporary.moveSync(new File(directory, 'draft.json'), { overwrite: true });
}
export async function keepStayPhoto(owner: string, journey: string, photo: SelectedPhoto): Promise<EditorPhoto> {
  const selected = await resolvePhoto(photo), id = requestId();
  let uri = selected.uri;
  if (Platform.OS !== 'web') { const directory = folder(owner, journey); directory.create({ intermediates: true, idempotent: true }); const file = new File(directory, `${id}.${selected.name.split('.').pop() || 'jpg'}`); new File(uri).copy(file); uri = file.uri; }
  return { key: id, request_id: id, uri, name: selected.name, mimeType: selected.mimeType };
}
export function clearStayDraft(owner: string, journey: string) { if (Platform.OS === 'web') localStorage.removeItem(`stay-draft:${owner}:${journey}`); else { const directory = folder(owner, journey); if (directory.exists) directory.delete(); } }
