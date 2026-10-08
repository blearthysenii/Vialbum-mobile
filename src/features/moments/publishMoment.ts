import type { Moment } from './types';
export type PublishStage = 'preparing' | 'uploading' | 'processing' | 'publishing';
// The same request ID and staged row are retained across lost responses and retries.
export async function publishMoment({ draft, create, upload, publish, onDraft, onStage, signal }: {
  draft: Moment | null;
  create: () => Promise<Moment>;
  upload: (id: string, progress: (value: number) => void) => Promise<Moment>;
  publish: (id: string) => Promise<Moment>;
  onDraft: (value: Moment) => void;
  onStage: (stage: PublishStage, progress?: number) => void;
  signal: AbortSignal;
}) {
  const check = () => { if (signal.aborted) throw new Error('Sharing cancelled.'); };
  check(); onStage('preparing');
  let item = draft ?? await create(); onDraft(item); check();
  if (item.status === 'draft') {
    onStage('uploading', 0);
    item = await upload(item.id, value => onStage(value === 100 ? 'processing' : 'uploading', value));
    onDraft(item); check();
  }
  if (item.status === 'published') return item;
  if (item.status !== 'ready') throw new Error('This Moment is not ready to share.');
  onStage('publishing');
  item = await publish(item.id); onDraft(item);
  return item;
}
