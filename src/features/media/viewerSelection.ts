import type { PublicPhoto } from '@/features/discover/types';
import type { PhotoOrigin } from './viewerGeometry';
// Sessions target the originating post, even if the same journey is mounted elsewhere.
type Session = { onSelect: (photoId: string) => void; origin?: PhotoOrigin; startDate?: string; photos?: PublicPhoto[]; onLocation?: (photoId: string) => void };
let nextSession = 0;
const listeners = new Map<string, Session>();
export function createViewerSelectionSession(onSelect: Session['onSelect'], options: Omit<Session, 'onSelect'> = {}) {
  const id = `photo-viewer-${++nextSession}`;
  listeners.set(id, { onSelect, ...options });
  return { id, dispose: () => { listeners.delete(id); } };
}
export function getViewerSession(sessionId: string | undefined) { return sessionId ? listeners.get(sessionId) : undefined; }
export function updateViewerSelection(sessionId: string | undefined, photoId: string) { getViewerSession(sessionId)?.onSelect(photoId); }
