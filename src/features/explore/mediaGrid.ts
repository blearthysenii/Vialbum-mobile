import type { SearchResults } from './api';
import type { Stay } from '@/features/stays/api';
export type MediaTile = { key: string; type: 'journey' | 'moment' | 'stay'; id: string; url: string; stay?: Stay };
export function mediaTiles(results: SearchResults): MediaTile[] {
  const candidates: (Omit<MediaTile, 'url'> & { url: string | null | undefined })[] = [
    ...results.journeys.items.map(item => ({ key: `journey:${item.id}`, type: 'journey' as const, id: item.id, url: (item as typeof item & { thumbnail_url?: string | null }).thumbnail_url ?? item.cover_media_url })),
    ...results.moments.items.map(item => ({ key: `moment:${item.id}`, type: 'moment' as const, id: item.id, url: item.cover_url })),
    ...results.stays.items.map(item => ({ key: `stay:${item.id}`, type: 'stay' as const, id: item.id, url: item.photos?.[0]?.url ?? item.tips.flatMap(tip => tip.photos)[0]?.url, stay: item })),
  ];
  return candidates.filter((item): item is MediaTile => Boolean(item.url));
}
function hash(value: string) { let result = 2166136261; for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619); return result >>> 0; }
export function appendMix(existing: MediaTile[], incoming: MediaTile[], seed: string) {
  const seen = new Set(existing.map(item => item.key));
  const fresh = incoming.filter(item => { if (seen.has(item.key)) return false; seen.add(item.key); return true; });
  fresh.sort((a, b) => hash(seed + a.key) - hash(seed + b.key) || a.key.localeCompare(b.key));
  return [...existing, ...fresh];
}
export function mediaBlocks(tiles: MediaTile[], seed: string) {
  const blocks: { key: string; items: MediaTile[]; tall: boolean; left: boolean }[] = [];
  let offset = 0;
  while (offset < tiles.length) {
    const index = blocks.length;
    // Reserve the same geometry for a block even when its next page has not arrived.
    const tall = index % 5 === 3;
    const items = tiles.slice(offset, offset + (tall ? 5 : 3));
    blocks.push({ key: items[0].key, items, tall, left: hash(seed + index) % 2 === 0 });
    offset += tall ? 5 : 3;
  }
  return blocks;
}
