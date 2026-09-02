import type { SearchResponse, SearchResult, SearchSection } from '@/features/search/types';

export const SEARCH_MIN_LENGTH = 2;
export const RECENT_SEARCH_LIMIT = 5;

export function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ');
}

export function normalizeRecentSearches(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = normalizeSearchQuery(item);
    if (normalized.length < SEARCH_MIN_LENGTH) continue;
    if (!result.some((existing) => existing.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
      result.push(normalized);
    }
  }
  return result.slice(0, RECENT_SEARCH_LIMIT);
}

export function addRecentSearch(current: string[], query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  if (normalized.length < SEARCH_MIN_LENGTH) return current;
  return [normalized, ...current.filter(
    (item) => item.toLocaleLowerCase() !== normalized.toLocaleLowerCase(),
  )].slice(0, RECENT_SEARCH_LIMIT);
}

export function groupSearchResults(results: SearchResponse): SearchSection[] {
  return [
    { title: 'Journeys' as const, data: results.journeys },
    { title: 'Memories' as const, data: results.memories },
    { title: 'Photos' as const, data: results.photos },
  ].filter((section) => section.data.length > 0);
}

function calendarDays(start: string, end: string) {
  const [sy, sm, sd] = start.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = end.slice(0, 10).split('-').map(Number);
  return Math.floor((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000);
}

export function resultMetadata(item: SearchResult): string {
  if (item.type === 'journey') return `${item.destination}, ${item.country}`;
  if (item.type === 'memory') {
    const day = calendarDays(item.journey_start_date, item.date) + 1;
    return `${item.journey_title} · Day ${day}`;
  }
  return [item.journey_title, item.memory_title].filter(Boolean).join(' · ');
}

export function searchNavigationTarget(item: SearchResult) {
  if (item.type === 'journey') return { pathname: '/journey/[id]' as const, params: { id: item.id } };
  if (item.type === 'memory') {
    return { pathname: '/journey/[id]' as const, params: { id: item.journey_id, memoryId: item.id } };
  }
  return {
    pathname: '/journey/[id]/photo/[mediaId]' as const,
    params: { id: item.journey_id, mediaId: item.id },
  };
}
