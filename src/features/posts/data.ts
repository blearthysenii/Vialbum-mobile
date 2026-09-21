import { apiRequest } from '@/api/client';
import type { AuthUser } from '@/features/auth/types';
import { discoverApi } from '@/features/discover/api';
import type { PublicJourneyDetail } from '@/features/discover/types';
import type { Journey } from '@/features/journeys/types';
import type { JourneyMedia } from '@/features/media/types';
export type PostJourney = Omit<PublicJourneyDetail, 'memories' | 'memory_count'>;

export function postTarget(id: string, own = false, memoryId?: string) {
  return { pathname: '/post/[id]' as const, params: { id, scope: own ? 'own' : 'public', ...(memoryId ? { memoryId } : {}) } };
}

export async function loadPost(id: string, own: boolean, user: AuthUser, signal: AbortSignal): Promise<PostJourney> {
  if (!own) return discoverApi.detail(id, signal);
  const [journey, media] = await Promise.all([
    apiRequest<Journey>(`/journeys/${encodeURIComponent(id)}`, { authenticated: true, signal }),
    apiRequest<JourneyMedia[]>(`/journeys/${encodeURIComponent(id)}/media`, { authenticated: true, signal }),
  ]);
  const photos = media.filter(item => item.type === 'photo');
  return { ...journey, photos, photo_count: photos.length,
    cover_width: null, cover_height: null, is_saved: false,
    creator: { id: user.id, username: user.username, display_name: [user.first_name, user.last_name].filter(Boolean).join(' '), avatar_url: user.profile_photo_url } };
}
