import { usePresentationStyles, resolvePresentationColor, presentationInterfaceStyle, presentationTextStyle } from '@/theme/presentation';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { VideoEditor } from '@/features/media/components/VideoEditor';
import { initialVideoEdit, videoEditError, type VideoEdit } from '@/features/media/videoEdit';
import Ionicons from '@expo/vector-icons/Ionicons';
import { requestId as newRequestId } from '@/features/journeys/draft';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { useAuth } from '@/features/auth/AuthProvider';
import { File } from 'expo-file-system';
import { router, useFocusEffect, useNavigation, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { placeApi } from '@/features/places/api';
import type { PlaceSelection } from '@/features/places/types';
import { useProfileTheme } from '@/features/profile/theme';
import { countryFlag, momentsApi } from './api';
import { createPlaybackGate } from './playback';
import { suggestedMomentJourneys } from './suggestions';
import { publishMoment } from './publishMoment';
import { VideoSurface } from './VideoSurface';
import type { Moment } from './types';
const MAX_BYTES = 64*1024*1024;
type Stage = 'editing' | 'preparing' | 'uploading' | 'processing' | 'publishing' | 'failed';
export function CreateMoment() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const { user } = useAuth();
  const navigation = useNavigation();
  const theme = useProfileTheme(); const { journeys } = useJourneys(); const gate = useMemo(() => createPlaybackGate(), []);
  const reducedMotion = useReducedMotion();
  const mediaEntrance = useRef(new Animated.Value(1)).current;
  const shareScale = useRef(new Animated.Value(1)).current;
  const [audienceOpen, setAudienceOpen] = useState(false);
  const surface = theme.dark ? 'rgba(255,255,255,0.065)' : '#F6F5F2';
  const hairline = theme.dark ? 'rgba(255,255,255,0.07)' : 'rgba(20,20,20,0.045)';
  const editorScroll = useMemo(() => Gesture.Native(), []);
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null); const [place, setPlace] = useState<PlaceSelection | null>(null);
  useEffect(() => {
    if (!asset) return;
    mediaEntrance.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(mediaEntrance, { toValue: 1, duration: reducedMotion ? 0 : 320, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [asset, mediaEntrance, reducedMotion]);
  const [query, setQuery] = useState(''); const [results, setResults] = useState<PlaceSelection[]>([]); const [searching, setSearching] = useState(false); const [searchError, setSearchError] = useState<string | null>(null);
  const [journeyId, setJourneyId] = useState<string | undefined>(); const [caption, setCaption] = useState(''); const [muted, setMuted] = useState(false); const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [stage, setStage] = useState<Stage>('editing'); const [progress, setProgress] = useState(0); const [error, setError] = useState<string | null>(null); const [coverTime, setCoverTime] = useState(0); const [capturedAt, setCapturedAt] = useState<string | undefined>();
  const [videoEdit, setVideoEdit] = useState<VideoEdit>();
  const currentTime = useRef(0); const requestId = useRef(newRequestId()); const draft = useRef<Moment | null>(null); const upload = useRef<AbortController | null>(null); const mounted = useRef(true); const publishing = useRef(false); const focused = useRef(false); const completed = useRef(false);
  const busy = ['preparing', 'uploading', 'processing', 'publishing'].includes(stage); const locked = stage !== 'editing' || Boolean(draft.current);
  useFocusEffect(useCallback(() => { focused.current = true; gate.allow(AppState.currentState === 'active'); return () => { focused.current = false; gate.stop(); }; }, [gate]));
  useEffect(() => { const subscription = AppState.addEventListener('change', state => gate.allow(focused.current && !publishing.current && state === 'active')); return () => subscription.remove(); }, [gate]);
  useEffect(() => { gate.select('preview', muted); gate.mute(muted); }, [muted, gate]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; upload.current?.abort(); gate.stop(); }; }, [gate]);
  useEffect(() => {
    if (!draftId) return;
    const controller = new AbortController(); setStage('preparing');
    void momentsApi.get(draftId, controller.signal).then(item => {
      if (controller.signal.aborted) return;
      if (item.creator.id !== user?.id || item.status === 'deleting') throw new Error('This draft is unavailable.');
      if (item.status === 'published') { completed.current = true; router.replace({ pathname: '/moment/[id]', params: { id: item.id } }); return; }
      draft.current = item; setPlace(item.place); setJourneyId(item.journey_id ?? undefined);
      setCaption(item.caption ?? ''); setMuted(item.audio_muted); setVisibility(item.visibility);
      setStage('failed'); setError(null);
    }).catch(failure => { if (!controller.signal.aborted) { setStage('failed'); setError(failure.message); } });
    return () => controller.abort();
  }, [draftId, user?.id]);
  useEffect(() => {
    if (place || query.trim().length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timeout = setTimeout(() => { setSearching(true); setSearchError(null); void placeApi.search(query.trim(), controller.signal).then(values => { if (!controller.signal.aborted) setResults(values); }).catch(failure => { if (!controller.signal.aborted) setSearchError(failure.message); }).finally(() => { if (!controller.signal.aborted) setSearching(false); }); }, 300);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query, place]);
  const selectVideo = async () => {
    try {
      gate.stop(); const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, quality: 1 });
      if (picked.canceled) return; const selected = picked.assets[0];
      const size = selected.fileSize ?? new File(selected.uri).size;
      if (size > MAX_BYTES) throw new Error('Choose a video smaller than 64 MB.');
      if (selected.mimeType && !['video/mp4', 'video/quicktime', 'video/x-m4v'].includes(selected.mimeType)) throw new Error('Choose an MP4 or MOV video.');
      mediaEntrance.setValue(reducedMotion ? 1 : 0); setAsset(selected); void Haptics.selectionAsync().catch(() => undefined);
      const edit = draft.current?.trim_end_seconds ? { trimStart: draft.current.trim_start_seconds ?? 0, trimEnd: draft.current.trim_end_seconds, coverTime: draft.current.cover_time_seconds ?? 0 } : initialVideoEdit((selected.duration ?? 0) / 1000);
      setVideoEdit(edit); setCoverTime(edit.coverTime); setError(null);
      // Optional local capture date; no GPS is sent or used as a published place.
      const info = selected.assetId ? await MediaLibrary.getAssetInfoAsync(selected.assetId, { shouldDownloadFromNetwork: false }).catch(() => null) : null;
      setCapturedAt(info?.creationTime ? new Date(info.creationTime).toISOString() : undefined);
    } catch (failure) { Alert.alert('Choose another video', failure instanceof Error ? failure.message : 'This video could not be opened.'); }
    finally { gate.allow(focused.current && AppState.currentState === 'active'); }
  };
  const share = async () => {
    if (asset && (!videoEdit || videoEditError(videoEdit, asset.duration ? asset.duration / 1000 : undefined))) { setError('Select a valid video segment of up to 60 seconds.'); return; }
    if (!place || busy || (!asset && draft.current?.status !== 'ready')) return; setError(null); gate.stop(); publishing.current = true;
    const controller = new AbortController(); upload.current = controller;
    try {
      const item = await publishMoment({
        draft: draft.current, signal: controller.signal,
        create: () => momentsApi.create({ request_id: requestId.current, place, journey_id: journeyId, caption: caption.trim(), visibility, audio_muted: muted, captured_at: capturedAt, trim_start_seconds: videoEdit?.trimStart, trim_end_seconds: videoEdit?.trimEnd, cover_time_seconds: videoEdit?.coverTime }),
        upload: (id, progress) => { if (!asset) throw new Error('Choose your video to finish sharing.'); return momentsApi.upload(id, { uri: asset.uri, name: asset.fileName || 'moment.mp4', type: asset.mimeType || 'video/mp4' }, coverTime, progress, controller.signal, videoEdit); },
        publish: momentsApi.publish,
        onDraft: item => { draft.current = item; },
        onStage: (stage, progress) => { if (mounted.current) { setStage(stage); if (progress !== undefined) setProgress(progress); } },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      completed.current = true;
      if (mounted.current) router.replace({ pathname: '/moment/[id]', params: { id: item.id } });
    } catch (failure) { if (mounted.current) { setStage('failed'); setError(failure instanceof Error ? failure.message : 'Could not publish. Retry without uploading twice.'); } }
    finally { publishing.current = false; }
  };
  const close = useCallback(() => {
    if (publishing.current) { Alert.alert('Finishing your Moment', 'Wait for publishing to finish, or retry when it fails.'); return; }
    if (!asset && !draft.current) { completed.current = true; router.back(); return; }
    Alert.alert('Discard Moment?', 'Your selected video stays in Photos. Any uploaded draft will be removed.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => {
      if (draft.current) void momentsApi.delete(draft.current.id).then(() => { completed.current = true; router.back(); }).catch(failure => Alert.alert('Could not discard', failure.message)); else { completed.current = true; router.back(); }
    } }]);
  }, [asset]);
  useEffect(() => navigation.addListener('beforeRemove', event => {
    if (!completed.current && (publishing.current || asset || draft.current)) { event.preventDefault(); close(); }
  }), [navigation, close, asset]);
  const relevant = suggestedMomentJourneys(journeys, place, capturedAt);
  const headings: Record<Stage, string> = { editing: 'Share Moment', preparing: 'Preparing…', uploading: `Uploading ${progress}%`, processing: 'Preparing video & cover…', publishing: 'Publishing…', failed: 'Retry sharing' };
  const validSelection = Boolean(asset && videoEdit && !videoEditError(videoEdit, asset.duration ? asset.duration / 1000 : undefined));
  const canShare = Boolean(place && !busy && (asset ? validSelection : draft.current?.status === 'ready'));
  const audience = (value: 'public' | 'private') => { setVisibility(value); setAudienceOpen(false); void Haptics.selectionAsync().catch(() => undefined); };
  const pressShare = (value: number) => Animated.timing(shareScale, { toValue: value, duration: 100, useNativeDriver: true }).start();
  return <GestureHandlerRootView style={styles.screen}><SafeAreaView style={[styles.screen, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'canvas') }]}>
    <View style={styles.nav}>
      <Pressable onPress={close} accessibilityLabel="Close New Moment" style={({ pressed }) => [styles.close, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'control'), transform: [{ scale: pressed ? 0.96 : 1 }] }]}><Ionicons name="close" size={23} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable>
      <Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>New Moment</Text>
      <View style={styles.navRight}>{!asset && !draft.current && !busy ? <Pressable accessibilityLabel="Open Moment drafts" onPress={() => router.push('/moment/drafts')}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13 })}>Drafts</Text></Pressable> : null}</View>
    </View>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <GestureDetector gesture={editorScroll}><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: mediaEntrance, transform: [{ scale: mediaEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>
      {asset ? <><VideoEditor creationStyle scrollGesture={editorScroll} key={asset.uri} uri={asset.uri} duration={asset.duration ? asset.duration / 1000 : undefined} edit={videoEdit} onChange={edit => { setVideoEdit(edit); setCoverTime(edit.coverTime); }} theme={theme} muted={muted} disabled={busy} /><View style={styles.mediaActions}><Pressable disabled={locked} onPress={() => void selectVideo()}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontSize: 13 })}>Change video</Text></Pressable><Pressable disabled={locked} onPress={() => setMuted(value => !value)}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontSize: 13 })}>{muted ? 'Enable audio' : 'Mute audio'}</Text></Pressable></View></> : draft.current?.video_url ? <View style={styles.preview}><VideoSurface id="preview" uri={draft.current.video_url} gate={gate} active onTime={time => { currentTime.current = time; }} /></View> : <View style={[styles.choose, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'content'), borderColor: resolvePresentationColor(hairline, 'borderColor', 'content') }]}>
        <View style={[styles.videoSymbol, { backgroundColor: resolvePresentationColor(theme.dark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.8)', 'backgroundColor', 'media') }]}><Ionicons name="videocam-outline" size={31} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></View>
        <Text style={presentationTextStyle([styles.mediaTitle, { color: resolvePresentationColor(theme.ink, 'color', 'media') }])}>Add a video</Text>
        <Text style={presentationTextStyle([styles.mediaHelp, { color: resolvePresentationColor(theme.muted, 'color', 'media') }])}>Choose a video from your gallery{`\n`}and trim up to 60 seconds.</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void selectVideo()} style={({ pressed }) => [styles.chooseButton, { backgroundColor: resolvePresentationColor(theme.ink, 'backgroundColor', 'control'), opacity: pressed ? 0.82 : 1 }]}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.canvas, 'color', 'content'), fontWeight: '600', fontSize: 14 })}>Choose video</Text></Pressable>
      </View>}
      </Animated.View>
      <View style={styles.section}>
        <View style={styles.sectionHeading}><Ionicons name="location-outline" size={20} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle([styles.heading, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Where was this?</Text></View>
        {place ? <Pressable disabled={locked} accessibilityLabel="Change selected place" onPress={() => { setPlace(null); setQuery(''); setJourneyId(undefined); }} style={[styles.selectedPlace, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'control') }]}><View style={[styles.placeSymbol, { backgroundColor: resolvePresentationColor(theme.dark ? 'rgba(255,255,255,0.06)' : 'white', 'backgroundColor', 'content') }]}><Text style={presentationTextStyle({ fontSize: 23 })}>{countryFlag(place.country_code)}</Text></View><View style={styles.flex}><Text numberOfLines={2} style={presentationTextStyle([styles.placeTitle, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{place.name}</Text><Text numberOfLines={2} style={presentationTextStyle([styles.placeSubtitle, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{place.display_name}</Text></View><Ionicons name="checkmark-circle" size={22} color={resolvePresentationColor(theme.accent, 'color', 'content')} /></Pressable> : <>
          <View style={[styles.search, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'content') }]}><Ionicons name="search-outline" size={18} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><TextInput editable={!locked} value={query} onChangeText={setQuery} placeholder="Search a city, landmark or place" placeholderTextColor={resolvePresentationColor(theme.muted, 'placeholderTextColor', 'control')} autoCorrect={false} returnKeyType="search" onSubmitEditing={Keyboard.dismiss} style={presentationTextStyle([styles.searchInput, { color: resolvePresentationColor(theme.ink, 'color', 'control') }])} keyboardAppearance={presentationInterfaceStyle()} />{searching ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} size="small" /> : null}</View>
          {searchError ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.danger, 'color', 'content') })}>{searchError}</Text> : null}
          {results.length ? <View style={[styles.suggestions, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'content') }]}>{results.map(result => <Pressable key={`${result.provider}:${result.provider_place_id}`} disabled={locked} onPress={() => { Keyboard.dismiss(); void Haptics.selectionAsync().catch(() => undefined); setPlace(result); setResults([]); }} style={styles.result}><Ionicons name="location-outline" size={20} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><View style={styles.flex}><Text style={presentationTextStyle([styles.placeTitle, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{result.name}</Text><Text numberOfLines={2} style={presentationTextStyle([styles.placeSubtitle, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{result.display_name}</Text></View></Pressable>)}</View> : null}
        </>}
        <Text style={presentationTextStyle([styles.help, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>Only the place you choose is shared. Embedded GPS stays private.</Text>
      </View>
      {place ? <View style={styles.section}><View style={styles.sectionHeading}><Ionicons name="trail-sign-outline" size={20} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle([styles.heading, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Link a journey</Text><Text style={presentationTextStyle([styles.optional, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>optional</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"><View style={styles.journeys}>{[undefined, ...relevant.map(journey => journey.id), ...journeys.filter(journey => !relevant.some(item => item.id === journey.id)).map(journey => journey.id)].map(id => <Pressable key={id || 'none'} disabled={locked} onPress={() => setJourneyId(id)} style={[styles.chip, { backgroundColor: resolvePresentationColor(id === journeyId ? surface : theme.canvas, 'backgroundColor', 'control'), borderColor: resolvePresentationColor(hairline, 'borderColor', 'control') }]}><Text style={presentationTextStyle({ color: resolvePresentationColor(id === journeyId ? theme.ink : theme.muted, 'color', 'content'), fontSize: 13 })}>{id ? journeys.find(journey => journey.id === id)?.title : 'Standalone Moment'}</Text></Pressable>)}</View></ScrollView></View> : null}
      <View style={styles.section}><View style={styles.sectionHeading}><Ionicons name="create-outline" size={20} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle([styles.heading, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>A few words</Text><Text style={presentationTextStyle([styles.optional, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>optional</Text></View><View style={[styles.caption, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'content') }]}><TextInput editable={!locked} value={caption} onChangeText={setCaption} maxLength={280} multiline placeholder="What made this place special?" placeholderTextColor={resolvePresentationColor(theme.muted, 'placeholderTextColor', 'control')} style={presentationTextStyle([styles.captionInput, { color: resolvePresentationColor(theme.ink, 'color', 'control') }])} keyboardAppearance={presentationInterfaceStyle()} /><Text style={presentationTextStyle([styles.count, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{Array.from(caption).length}/280</Text></View></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Visibility: ${visibility === 'public' ? 'Public' : 'Only me'}`} disabled={locked} onPress={() => { Keyboard.dismiss(); setAudienceOpen(true); }} style={[styles.audience, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'control') }]}><Ionicons name={visibility === 'public' ? 'globe-outline' : 'lock-closed-outline'} size={21} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><View style={styles.flex}><Text style={presentationTextStyle([styles.heading, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Visibility</Text><Text style={presentationTextStyle([styles.placeSubtitle, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>Who can see this Moment?</Text></View><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 14 })}>{visibility === 'public' ? 'Public' : 'Only me'}</Text><Ionicons name="chevron-forward" size={16} color={resolvePresentationColor(theme.muted, 'color', 'content')} /></Pressable>
      {error ? <Text accessibilityRole="alert" style={presentationTextStyle({ color: resolvePresentationColor(theme.danger, 'color', 'content'), lineHeight: 21 })}>{error}</Text> : null}
      <Animated.View style={{ transform: [{ scale: shareScale }] }}><Pressable accessibilityRole="button" accessibilityState={{ disabled: !canShare, busy }} disabled={!canShare} onPressIn={() => pressShare(0.98)} onPressOut={() => pressShare(1)} onPress={() => { Keyboard.dismiss(); void share(); }} style={[styles.share, { backgroundColor: resolvePresentationColor(canShare || busy ? theme.ink : surface, 'backgroundColor', 'control') }]}>{busy ? <ActivityIndicator color={resolvePresentationColor(theme.canvas, 'color', 'content')} /> : null}<Text style={presentationTextStyle({ color: resolvePresentationColor(canShare || busy ? theme.canvas : theme.muted, 'color', 'content'), fontSize: 16, fontWeight: '600' })}>{headings[stage]}</Text></Pressable></Animated.View>
      {draft.current && stage === 'failed' ? <Text style={presentationTextStyle([styles.help, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>Your draft is held for retry. Discard it to change the place or sharing options.</Text> : null}
    </ScrollView></GestureDetector>
    </KeyboardAvoidingView>
    <Modal visible={audienceOpen} transparent animationType="slide" onRequestClose={() => setAudienceOpen(false)}><View style={styles.modal}><Pressable accessibilityLabel="Dismiss visibility options" style={styles.flex} onPress={() => setAudienceOpen(false)} /><SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'surface') }]}><View style={[styles.grabber, { backgroundColor: resolvePresentationColor(theme.border, 'backgroundColor', 'content') }]} /><Text style={presentationTextStyle([styles.sheetTitle, { color: resolvePresentationColor(theme.ink, 'color', 'surface') }])}>Who can see this Moment?</Text>{(['public', 'private'] as const).map(value => <Pressable key={value} disabled={locked} accessibilityRole="radio" accessibilityState={{ checked: visibility === value }} onPress={() => audience(value)} style={styles.audienceOption}><Ionicons name={value === 'public' ? 'globe-outline' : 'lock-closed-outline'} size={24} color={resolvePresentationColor(theme.ink, 'color', 'content')} /><View style={styles.flex}><Text style={presentationTextStyle([styles.placeTitle, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{value === 'public' ? 'Public' : 'Only me'}</Text><Text style={presentationTextStyle([styles.placeSubtitle, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{value === 'public' ? 'Visible to other travelers' : 'Visible only to you'}</Text></View>{visibility === value ? <Ionicons name="checkmark" size={22} color={resolvePresentationColor(theme.accent, 'color', 'content')} /> : null}</Pressable>)}<Pressable onPress={() => setAudienceOpen(false)} style={styles.cancel}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>Cancel</Text></Pressable></SafeAreaView></View></Modal>
  </SafeAreaView></GestureHandlerRootView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, flex: { flex: 1 }, nav: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }, close: { width: 44, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, navRight: { width: 44, alignItems: 'flex-end' }, title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600' }, content: { padding: 20, gap: 26, paddingBottom: 28 }, preview: { height: 340, width: '100%', borderRadius: 24, overflow: 'hidden', backgroundColor: '#111111' }, choose: { minHeight: 286, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 15 }, videoSymbol: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, mediaTitle: { fontSize: 23, fontWeight: '600' }, mediaHelp: { fontSize: 14, lineHeight: 21, textAlign: 'center' }, chooseButton: { paddingHorizontal: 24, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 6 }, mediaActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }, section: { gap: 12 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 }, heading: { fontSize: 16, fontWeight: '600' }, optional: { fontSize: 12 }, help: { fontSize: 11, lineHeight: 16 }, search: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 9, borderRadius: 17, minHeight: 52 }, searchInput: { flex: 1, minHeight: 52, fontSize: 14, paddingVertical: 12 }, selectedPlace: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18 }, placeSymbol: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, placeTitle: { fontSize: 14, fontWeight: '500' }, placeSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 }, suggestions: { borderRadius: 18, overflow: 'hidden' }, result: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, journeys: { flexDirection: 'row', gap: 8 }, chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth }, caption: { borderRadius: 18, padding: 15 }, captionInput: { minHeight: 72, textAlignVertical: 'top', fontSize: 14, lineHeight: 21 }, count: { textAlign: 'right', fontSize: 10, marginTop: 8 }, audience: { minHeight: 76, padding: 15, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }, share: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 }, modal: { flex: 1, backgroundColor: 'transparent' }, sheet: { padding: 22, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 12 }, grabber: { width: 34, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 }, sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 }, audienceOption: { flexDirection: 'row', gap: 14, alignItems: 'center', minHeight: 68 }, cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' } });
const presentationBaselineStyles = styles;
