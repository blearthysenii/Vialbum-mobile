import { Image, type ImageProps } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { cachedImageSource } from '../imageUrl';
import { decodedThumbnail, retainDecodedThumbnail } from '../decodedThumbnailCache';

// Expo's iOS cache defaults to no explicit memory limit. Keep the fast decoded
// cache evictable and bounded; disk remains the fallback for long profiles.
if (Platform.OS === 'ios') Image.configureCache({ maxMemoryCost: 64 * 1024 * 1024, maxMemoryCount: 256 });

type Source = ReturnType<typeof cachedImageSource>;
// Keep the decoded native image in its own slot while the next source loads.
// Swapping opacity after onDisplay avoids removing the old asset or replaying fades.
export const StableCachedImage = memo(function StableCachedImage({ uri, namespace, style, onLoad, onError, onSourceError, contentFit = 'cover', cacheScope, retryToken = 0 }: {
  retryToken?: number; cacheScope?: string; uri: string | null; namespace: string; style: StyleProp<ImageStyle>;
  onSourceError?: () => void; onLoad?: ImageProps['onLoad']; onError?: ImageProps['onError']; contentFit?: ImageProps['contentFit'];
}) {
  const trace = useCallback((event: string, detail?: unknown) => {
    if (__DEV__ && cacheScope) console.debug('[Profile thumbnail]', event, { namespace, detail });
  }, [cacheScope, namespace]);
  const mountedAt = useRef(Date.now());
  const mountUri = useRef(uri);
  useEffect(() => {
    trace('mount', { nativeReference: Boolean(cacheScope && mountUri.current && decodedThumbnail(cacheScope, cachedImageSource(mountUri.current, `${cacheScope}:${namespace}`).cacheKey, mountUri.current)) });
    return () => trace('unmount');
  }, [trace, cacheScope, namespace]);
  const previousUri = useRef(uri);
  useEffect(() => {
    if (previousUri.current !== uri) trace('source-changed', { sameAsset: previousUri.current?.split(/[?#]/, 1)[0] === uri?.split(/[?#]/, 1)[0] });
    previousUri.current = uri;
  }, [uri, trace]);
  const incoming = useMemo(() => uri ? cachedImageSource(uri, cacheScope ? `${cacheScope}:${namespace}` : namespace) : null, [uri, namespace, cacheScope]);
  const [slots, setSlots] = useState<[Source | null, Source | null]>(() => [incoming, null]);
  const [active, setActive] = useState(0);
  const decoded = useRef(false);
  const displayed = useRef<[Source | null, Source | null]>([null, null]);
  const requested = useRef(incoming);
  const failed = useRef<string | null>(null);
  requested.current = incoming;
  useEffect(() => { failed.current = null; }, [retryToken]);
  useEffect(() => {
    if (!incoming) { decoded.current = false; displayed.current = [null, null]; if (slots[0] || slots[1]) setSlots([null, null]); if (active !== 0) setActive(0); return; }
    const current = slots[active];
    if (current?.uri === incoming.uri && current.cacheKey === incoming.cacheKey) return;
    if (!decoded.current) { displayed.current = [null, null]; setSlots([incoming, null]); setActive(0); return; }
    const next = active === 0 ? 1 : 0;
    if (slots[next]?.uri === incoming.uri && slots[next]?.cacheKey === incoming.cacheKey) {
      // A previously displayed source may still occupy the other slot. It will
      // not emit another native display event unless its source changes.
      if (displayed.current[next]?.uri === incoming.uri && displayed.current[next]?.cacheKey === incoming.cacheKey) setActive(next);
      return;
    }
    displayed.current[next] = null;
    setSlots(previous => { const copy: [Source | null, Source | null] = [...previous]; copy[next] = incoming; return copy; });
  }, [incoming, active, slots]);
  if (!incoming) return null;
  return <View style={style as StyleProp<ViewStyle>}>
    {slots.map((source, index) => source ? <Image key={`${index}:${retryToken}`} source={(cacheScope && decodedThumbnail(cacheScope, source.cacheKey, source.uri)) || source} contentFit={contentFit} cachePolicy="memory-disk" transition={0}
      style={[StyleSheet.absoluteFill, { opacity: index === active ? 1 : 0 }]}
      onLoadStart={() => trace('uri-load-start', { hasDisplayedImage: Boolean(displayed.current[active]), nativeReference: Boolean(cacheScope && decodedThumbnail(cacheScope, source.cacheKey, source.uri)) })}
      onProgress={event => trace('loader-progress', { loaded: event.loaded, total: event.total })}
      onLoad={event => {
        trace('uri-load-complete', { cacheType: event.cacheType });
        if (requested.current?.uri !== source.uri || requested.current.cacheKey !== source.cacheKey) return;
        onLoad?.(event);
      }}
      onDisplay={() => {
        if (requested.current?.uri !== source.uri || requested.current.cacheKey !== source.cacheKey) return;
        trace('display', { millisecondsSinceMount: Date.now() - mountedAt.current, nativeReference: Boolean(cacheScope && decodedThumbnail(cacheScope, source.cacheKey, source.uri)) });
        if (cacheScope) void retainDecodedThumbnail(cacheScope, source.cacheKey, source.uri, () => Image.readFromCacheAsync(source.cacheKey));
        displayed.current[index] = source; decoded.current = true; setActive(index);
      }}
      onError={event => {
        trace('source-error');
        if (requested.current?.uri !== source.uri || requested.current.cacheKey !== source.cacheKey || failed.current === `${source.cacheKey}:${source.uri}`) return;
        failed.current = `${source.cacheKey}:${source.uri}`; onSourceError?.();
        if (!decoded.current) onError?.(event);
      }} /> : null)}
  </View>;
});
