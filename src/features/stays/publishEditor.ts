import { staysApi } from './api';
import type { EditorDraft } from './editorDraft';
export async function publishStayEditor(journey: string, draft: EditorDraft, checkpoint: (draft: EditorDraft) => void, progress: (label: string, percent: number) => void) {
  const run = async <T,>(stage: string, status: number, operation: () => Promise<T>): Promise<T> => {
    try {
      const result = await operation();
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.info('[StayCreate]', { stage, status });
      return result;
    } catch (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[StayCreate]', {
        stage, status: error && typeof error === 'object' && 'status' in error ? error.status : 'unknown',
      });
      throw error;
    }
  };
  let value = draft;
  const save = (next: EditorDraft) => { value = next; checkpoint(value); };
  if (!value.recommendationId) {
    const rec = await run('create', 201, () => staysApi.add(journey, { ...value.input, request_id: value.request_id, draft: true }));
    save({ ...value, recommendationId: rec.id });
  } else await run('update', 200, () => staysApi.edit(value.recommendationId!, { ...value.input, name: value.input.name ?? value.input.manual_name ?? value.input.place?.name }));
  const id = value.recommendationId!;
  for (const photoId of [...value.removed]) { await staysApi.deletePhoto(id, photoId); save({ ...value, removed: value.removed.filter(item => item !== photoId) }); }
  for (let index = 0; index < value.photos.length; index++) {
    const photo = value.photos[index];
    if (photo.server) continue;
    const uploaded = await run('media upload', 201, () => staysApi.upload(id, photo, percent => progress(`Uploading photo ${index + 1} of ${value.photos.length}`, percent)));
    save({ ...value, photos: value.photos.map(item => item.key === photo.key ? { ...item, server: uploaded, replace_id: undefined } : item) });
  }
  progress('Saving recommendation', 100);
  await run('media association', 200, () => staysApi.order(id, value.photos.map(photo => photo.server!.id)));
  return run('publish', 200, () => staysApi.publish(id));
}
