import { Image, type ImageRef } from 'expo-image';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { acquireJourneyThumbnail, decodedJourneyThumbnail, decodedThumbnailCacheStats } from '../decodedThumbnailCache';
import { cachedImageSource } from '../imageUrl';

type Ready = { scope: string; namespace: string; uri: string; image: ImageRef };
// Only Journey grid tiles use this path. Moments keep StableCachedImage unchanged.
export const JourneyThumbnailImage = memo(function JourneyThumbnailImage({ uri, namespace, cacheScope, pixelSize, retryToken = 0, onLoad, onError, onSourceError }: {
  uri: string; namespace: string; cacheScope: string; pixelSize: number; retryToken?: number;
  onLoad?: () => void; onError?: () => void; onSourceError?: () => void;
}) {
  const limit = Math.min(480, Math.max(1, Math.ceil(pixelSize)));
  const source = useMemo(() => cachedImageSource(uri, `${cacheScope}:${namespace}`), [uri, cacheScope, namespace]);
  // Keep the encoded disk identity; dimensions belong only to the decoded entry.
  const previousSource = useRef(source);
  const bitmapKey = `${source.cacheKey}:grid-native:${limit}`;
  const cached = decodedJourneyThumbnail(cacheScope, bitmapKey);
  const [ready, setReady] = useState<Ready | null>(() => cached ? { scope: cacheScope, namespace, uri, image: cached } : null);
  const held = ready?.scope === cacheScope && ready.namespace === namespace ? ready : null;
  const shown = cached ? { scope: cacheScope, namespace, uri, image: cached } : held;
  const callbacks = useRef({ onLoad, onError, onSourceError }); callbacks.current = { onLoad, onError, onSourceError };
  const visible = useRef(shown); visible.current = shown;
  const mounted = useRef(Date.now());
  const trace = (event: string, detail?: unknown) => {
    if (__DEV__) console.debug('[Journey thumbnail]', event, { namespace, detail });
  };
  useEffect(() => {
    if (__DEV__) console.debug('[Journey thumbnail] mount', { namespace, nativeReference: Boolean(decodedJourneyThumbnail(cacheScope, bitmapKey)), pixelSize: limit });
    return () => { if (__DEV__) console.debug('[Journey thumbnail] unmount', { namespace }); };
    // Mount diagnostics intentionally capture the initial asset, not URL renewals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheScope, namespace]);
  useEffect(() => {
    let current = true;
    const warm = decodedJourneyThumbnail(cacheScope, bitmapKey);
    if (__DEV__) console.debug('[Journey thumbnail] source', { namespace, uriChanged: previousSource.current.uri !== uri, sameAsset: previousSource.current.cacheKey === source.cacheKey, retained: Boolean(warm), hasDisplayedReference: Boolean(visible.current), derivative: uri.split(/[?#]/, 1)[0].endsWith('.thumbnail-v1.jpg'), pixelSize: limit });
    previousSource.current = source;
    const lease = acquireJourneyThumbnail(cacheScope, bitmapKey, uri, () => {
      if (__DEV__) console.debug('[Journey thumbnail] bounded-load-start', { namespace, pixelSize: limit });
      if (__DEV__) void Image.getCachePathAsync(source.cacheKey).then(path => {
        console.debug('[Journey thumbnail] encoded-cache-check', { namespace, diskEntryPresent: Boolean(path) });
      }).catch(() => console.debug('[Journey thumbnail] encoded-cache-check-unavailable', { namespace }));
      // Expo's installed iOS loader passes these pixel bounds to its native
      // thumbnail decoder and uses the existing encoded disk cache first.
      return Image.loadAsync(source, { maxWidth: limit, maxHeight: limit });
    }, namespace);
    void lease.promise.then(image => {
      if (!current || !image) return;
      if (__DEV__) console.debug('[Journey thumbnail] bounded-ready', { namespace, width: image.width, height: image.height, scale: image.scale, ...decodedThumbnailCacheStats() });
      setReady(previous => previous?.scope === cacheScope && previous.namespace === namespace && previous.uri === uri && previous.image === image ? previous : { scope: cacheScope, namespace, uri, image });
    }).catch(() => {
      if (!current) return;
      if (__DEV__) console.warn('[Journey thumbnail] bounded-load-failed', { namespace, keptDisplayedReference: Boolean(visible.current) });
      callbacks.current.onSourceError?.();
      if (!visible.current) callbacks.current.onError?.();
    });
    return () => { current = false; lease.release(); };
  }, [cacheScope, namespace, uri, source, bitmapKey, limit, retryToken]);
  // Initial cold loading can show the cell's existing background. After first
  // display the retained ImageRef is the very first native source on remount.
  // An eviction cannot turn a mounted source back into an asynchronous URI.
  if (!shown) return null;
  return <Image source={shown.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={0}
    onDisplay={() => {
      trace('display', { millisecondsSinceMount: Date.now() - mounted.current, currentSource: shown.uri === uri, nativeReference: true });
      if (shown.uri === uri) callbacks.current.onLoad?.();
    }} />;
});
