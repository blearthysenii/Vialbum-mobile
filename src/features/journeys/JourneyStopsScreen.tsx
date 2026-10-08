import { resolvePresentationColor } from '@/theme/presentation';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { router } from 'expo-router';
import { journeyApi } from './api';
import { mediaApi } from '@/features/media/api';
import { JourneyStopsEditor } from './components/JourneyStopsEditor';
import type { DraftStop } from './stops';
import { useProfileTheme } from '@/features/profile/theme';

export function JourneyStopsScreen({ id }: { id: string }) {
  const theme = useProfileTheme();
  const [data, setData] = useState<{ stops: DraftStop[]; media: { key: string; name: string }[] } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([journeyApi.stops(id), mediaApi.list(id)]).then(([stops, media]) => { if (live) setData({ stops: stops.map(stop => ({ id: stop.id, label: stop.label, place: stop.place, mediaKeys: stop.media_ids })), media: media.map(item => ({ key: item.id, name: item.original_filename ?? 'Journey media' })) }); }).catch(error => { if (live) Alert.alert('Could not load stops', error.message, [{ text: 'Back', onPress: () => router.back() }]); });
    return () => { live = false; };
  }, [id]);
  const save = async (stops: DraftStop[]) => {
    if (saving) return; setSaving(true);
    try { await journeyApi.saveStops(id, stops.map(stop => ({ id: stop.id, label: stop.label.trim() || stop.place.name, place: stop.place, media_ids: stop.mediaKeys }))); router.back(); }
    catch (error) { Alert.alert('Could not save stops', error instanceof Error ? error.message : 'Try again.'); }
    finally { setSaving(false); }
  };
  return <View style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}>{data ? <JourneyStopsEditor stops={data.stops} media={data.media} theme={theme} onClose={() => { if (!saving) router.back(); }} onSave={stops => { void save(stops); }} closeAfterSave={false} disabled={saving} /> : <ActivityIndicator color={resolvePresentationColor(theme.ink, 'color', 'content')} />}</View>;
}
