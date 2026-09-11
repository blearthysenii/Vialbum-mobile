import { apiBaseUrl } from '@/api/client';

export function resolveApiImageUrl(value: string | null | undefined, label: string) {
  const raw = value?.trim();
  if (!raw) return null;

  let resolved: string | null = null;
  if (/^https?:\/\//i.test(raw)) resolved = raw;
  else if (raw.startsWith('/')) {
    try { resolved = `${apiBaseUrl()}${raw}`; } catch { resolved = null; }
  }

  if (__DEV__) console.debug(`[Image URL] ${label}`, { source: raw, resolved });
  return resolved;
}

export function cachedImageSource(uri: string, namespace: string) {
  return {
    uri,
    cacheKey: `${namespace}:${uri.split(/[?#]/, 1)[0]}`,
  };
}
