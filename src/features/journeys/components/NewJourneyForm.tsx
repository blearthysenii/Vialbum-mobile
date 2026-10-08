import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { JourneyStopsEditor } from './JourneyStopsEditor';
import { usePreventRemove } from 'expo-router/react-navigation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { requireOptionalNativeModule } from 'expo';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { ApiError } from '@/api/client';
import { PrimaryButton } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { useAuth } from '@/features/auth/AuthProvider';
import { useJourneys } from '../JourneyProvider';
import { journeyApi } from '../api';
import { detailsError, movePhoto, newJourneyDraft, normalizeDraft, photoIdentity, removeDraftPhoto, requestId, type DraftPhoto, type JourneyDraft } from '../draft';
import { clearDraft, keepPhoto, restoreDraft, saveDraft } from '../draftStorage';
import { publishDraft } from '../publishDraft';
import { PhotoSelectionScreen } from './PhotoSelectionScreen';
import { PhotoEditingStep } from './PhotoEditingStep';
import { JourneyDetailsStep } from './JourneyDetailsStep';
import { pickPhotos } from '@/features/media/picker';
import type { SelectedPhoto } from '@/features/media/types';
import { LocationPicker } from '@/features/places/components/LocationPicker';
import { useProfileTheme } from '@/features/profile/theme';
import { colors } from '@/theme/colors';
import { discoverStoreFor, followingStoreFor } from '@/features/discover/cache';

const haptic = () => { void Haptics.selectionAsync().catch(() => undefined); };
const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
type Props = { draftId?: string; onCancel: () => void; onCreated: (id: string) => void };
export function NewJourneyForm(props: Props) {
  const { user } = useAuth();
  return user ? <Composer key={`${user.id}:${props.draftId ?? 'new'}`} {...props} userId={user.id} /> : null;
}
function Composer({ draftId, onCancel, onCreated, userId }: Props & { userId: string }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { refresh, applyPublished } = useJourneys();
  const editorScroll = useMemo(() => Gesture.Native(), []);
  const theme = useProfileTheme();
  const [draft, setDraft] = useState<JourneyDraft>(newJourneyDraft);
  const draftRef = useRef(draft);
  const photoCache = useRef(new Map<string, DraftPhoto>());
  const [restoring, setRestoring] = useState(Boolean(draftId));
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const lock = useRef(false);
  const [exit, setExit] = useState<'close' | string | null>(null);
  const closeDialog = useRef(false);
  const closeRef = useRef(() => {});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [locationKey, setLocationKey] = useState<string | null>(null);
  const [editingStops, setEditingStops] = useState(false);
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState({ label: '', percent: 0 });
  const reduceMotion = useReducedMotion();
  usePreventRemove((dirty || busy || picking) && !exit, () => closeRef.current());
  useEffect(() => { if (exit) { if (exit === 'close') onCancel(); else onCreated(exit); } }, [exit, onCancel, onCreated]);
  useEffect(() => {
    if (!draftId) return;
    let live = true;
    void restoreDraft(userId, draftId).then(value => {
      if (!live) return;
      draftRef.current = value; setDraft(value); setActiveKey(value.photos[0]?.key ?? null);
      value.photos.forEach(photo => photoCache.current.set(photoIdentity(photo), photo));
      if (value.photos.some(photo => photo.unavailable)) setError('Some draft photos are unavailable. Replace or remove them before creating your journey.');
    }).catch(caught => { if (live) { setRestoreFailed(true); setError(message(caught)); } }).finally(() => { if (live) setRestoring(false); });
    return () => { live = false; };
  }, [draftId, userId]);
  const change = useCallback((next: JourneyDraft, edited = true) => {
    const value = normalizeDraft(next);
    draftRef.current = value; setDraft(value);
    value.photos.forEach(photo => photoCache.current.set(photoIdentity(photo), photo));
    if (edited) { dirtyRef.current = true; setDirty(true); }
    try { saveDraft(userId, value); setStorageError(null); }
    catch { setStorageError('Your draft could not be saved. Keep Vialbum open and free some device storage.'); }
  }, [userId]);
  const updatePhoto = (key: string, values: Partial<DraftPhoto>) => change({ ...draftRef.current, photos: draftRef.current.photos.map(photo => photo.key === key ? { ...photo, ...values } : photo) });

  async function preparePhotos() {
    let current = draftRef.current;
    for (const photo of current.photos) {
      if (photo.unavailable) continue;
      if (!photo.needsImport) continue;
      const imported = await keepPhoto(userId, photo);
      const replacement = { ...photo, ...imported, key: photo.key, caption: photo.caption, place: photo.place, needsImport: false, unavailable: false };
      current = { ...draftRef.current, photos: draftRef.current.photos.map(item => item.key === photo.key ? replacement : item) };
      change(current, false);
    }
    return draftRef.current;
  }
  async function saveAndClose() {
    if (lock.current) return;
    lock.current = true; setPicking(true); setError(null);
    try { await preparePhotos(); saveDraft(userId, draftRef.current); setExit('close'); }
    catch (caught) { setError(`Draft could not be saved. ${message(caught)}`); }
    finally { lock.current = false; setPicking(false); }
  }
  async function discard() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const current = draftRef.current;
      // A server-side upload draft stays private. Resolve an uncertain create response
      // with the same retry key before discarding it, rather than orphaning it.
      if (current.uploadStarted) {
        try {
          const staged = current.journeyId ? await journeyApi.fetchJourney(current.journeyId) : await journeyApi.createJourney({ ...current.values, visibility: 'private', request_id: current.requestId });
          if (staged.visibility === 'private') await journeyApi.deleteJourney(staged.id);
        } catch (caught) { if (!(caught instanceof ApiError && caught.status === 404)) throw caught; }
        void refresh();
      }
      await clearDraft(userId, current); setExit('close');
    } catch (caught) { setError(`Draft could not be discarded. ${message(caught)}`); }
    finally { lock.current = false; setBusy(false); }
  }
  closeRef.current = () => {
    if (lock.current || closeDialog.current) return;
    Keyboard.dismiss();
    if (!dirtyRef.current) { setExit('close'); return; }
    closeDialog.current = true;
    const choose = (action?: () => void) => { closeDialog.current = false; action?.(); };
    Alert.alert('Save this journey as a draft?', 'Keep your photos and edits for later.', [
      { text: 'Save draft', onPress: () => choose(() => void saveAndClose()) },
      { text: 'Discard', style: 'destructive', onPress: () => choose(() => void discard()) },
      { text: 'Keep editing', style: 'cancel', onPress: () => choose() },
    ], { cancelable: true, onDismiss: () => choose() });
  };
  const back = () => {
    if (lock.current) return;
    Keyboard.dismiss(); setError(null);
    if (draftRef.current.step === 'details') change({ ...draftRef.current, step: 'photos' }, false);
    else if (draftRef.current.step === 'photos') { setAdding(false); change({ ...draftRef.current, step: 'select' }, false); }
    else if (adding) { setAdding(false); change({ ...draftRef.current, step: 'photos' }, false); }
    else closeRef.current();
  };
  const backRef = useRef(back); backRef.current = back;
  useFocusEffect(useCallback(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => { backRef.current(); return true; });
    const preferences = __DEV__ ? requireOptionalNativeModule<{
      getPreferencesAsync: () => Promise<{ showFloatingActionButton: boolean }>;
      setPreferencesAsync: (settings: { showFloatingActionButton: boolean }) => Promise<void>;
    }>('DevMenuPreferences') : null;
    let disposed = false; let previous: boolean | undefined;
    void preferences?.getPreferencesAsync().then(async settings => {
      previous = settings.showFloatingActionButton;
      if (!disposed) await preferences.setPreferencesAsync({ showFloatingActionButton: false });
      if (disposed && previous !== undefined) await preferences.setPreferencesAsync({ showFloatingActionButton: previous });
    }).catch(() => undefined);
    return () => { disposed = true; handler.remove(); if (previous !== undefined) void preferences?.setPreferencesAsync({ showFloatingActionButton: previous }).catch(() => undefined); };
  }, []));

  function toggle(photo: SelectedPhoto, single: boolean) {
    if (lock.current) return;
    const current = draftRef.current;
    const identity = photoIdentity(photo);
    const existing = current.photos.find(item => photoIdentity(item) === identity);
    if (existing) { change(removeDraftPhoto(current, existing.key)); }
    else {
      const cached = photoCache.current.get(identity);
      const item: DraftPhoto = cached ?? { ...photo, requestId: requestId(), caption: '', place: null, needsImport: true };
      change({ ...current, photos: single ? [item] : [...current.photos, item] });
      setActiveKey(item.key);
    }
    haptic();
  }
  async function systemPicker(replaceKey?: string) {
    if (lock.current) return;
    lock.current = true; setPicking(true); setError(null); Keyboard.dismiss();
    try {
      const chosen = await pickPhotos({ includeVideos: true });
      if (replaceKey && chosen.length) {
        const old = draftRef.current.photos.find(photo => photo.key === replaceKey)!;
        const imported = await keepPhoto(userId, { ...chosen[0], requestId: requestId() });
        updatePhoto(replaceKey, { ...imported, key: old.key, caption: old.caption, place: old.place, latitude: old.latitude, longitude: old.longitude, mediaId: undefined, unavailable: false, needsImport: false });
      } else {
        for (const photo of chosen) {
          if (draftRef.current.photos.some(item => photoIdentity(item) === photoIdentity(photo))) continue;
          const cached = photoCache.current.get(photoIdentity(photo));
          const kept = cached ?? await keepPhoto(userId, photo);
          change({ ...draftRef.current, photos: [...draftRef.current.photos, kept] });
          setActiveKey(kept.key);
        }
      }
    } catch (caught) { setError(`Photos could not be added. ${message(caught)}`); }
    finally { lock.current = false; setPicking(false); }
  }
  async function next() {
    if (lock.current || !draftRef.current.photos.length) return;
    if (draftRef.current.step === 'photos') {
      if (draftRef.current.photos.some(photo => photo.unavailable)) { setError('Replace or remove unavailable photos before continuing.'); return; }
      change({ ...draftRef.current, step: 'details' }, false); setError(null); Keyboard.dismiss(); haptic(); return;
    }
    lock.current = true; setPicking(true); setError(null);
    try { await preparePhotos(); change({ ...draftRef.current, step: 'photos' }, false); setAdding(false); haptic(); }
    catch (caught) { setError(message(caught)); }
    finally { lock.current = false; setPicking(false); }
  }
  async function createJourney() {
    if (lock.current) return;
    const validation = detailsError(draftRef.current.values);
    if (validation) { setError(validation); Keyboard.dismiss(); return; }
    if (draftRef.current.photos.some(photo => photo.unavailable)) { setError('Go back and replace or remove unavailable photos.'); return; }
    lock.current = true; setBusy(true); setError(null); Keyboard.dismiss();
    try {
      await preparePhotos();
      change({ ...draftRef.current, uploadStarted: true }, false);
      saveDraft(userId, draftRef.current);
      const id = await publishDraft(draftRef.current, checkpoint => { change(checkpoint, false); saveDraft(userId, checkpoint); }, (label, percent) => setProgress({ label, percent }), undefined, applyPublished);
      // A completed marker prevents a cleanup failure from offering the journey again.
      const completed = { ...draftRef.current, completed: true };
      try { saveDraft(userId, completed); await clearDraft(userId, completed); } catch { /* The server retry key also protects uncertain cleanup. */ }
      // Feed refresh failure must not turn an already completed upload into a retry.
      void discoverStoreFor(userId).refresh().catch(() => undefined); void followingStoreFor(userId).refresh().catch(() => undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setExit(id);
    } catch (caught) {
      let retained = true; try { saveDraft(userId, draftRef.current); } catch { retained = false; }
      setError(`${message(caught)} ${retained ? 'Your draft is saved. Tap Create journey to retry.' : 'Keep Vialbum open and free some device storage before retrying.'}`);
    } finally { lock.current = false; setBusy(false); }
  }
  const locationPhoto = draft.photos.find(photo => photo.key === locationKey);
  const cover = draft.photos.find(photo => photo.key === draft.coverKey);
  if (restoring || restoreFailed) return <SafeAreaView style={[styles.safe, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'canvas') }]}><View style={styles.loading}>{restoring ? <ActivityIndicator color={resolvePresentationColor(colors.accent, 'color', 'content')} /> : <><ErrorBanner style={{ backgroundColor: resolvePresentationColor(theme.glassStrong, 'backgroundColor', 'content'), borderColor: resolvePresentationColor(theme.border, 'borderColor', 'content') }} textStyle={{ color: theme.ink }} message={error ?? 'Draft unavailable.'} /><Pressable accessibilityRole="button" onPress={() => setExit('close')} style={styles.headerAction}><Text style={presentationTextStyle(styles.blue)}>Close</Text></Pressable></>}</View></SafeAreaView>;
  if (draft.step === 'select') return <PhotoSelectionScreen selected={draft.photos} busy={busy || picking} error={error ?? storageError} onToggle={toggle} onSystemPicker={() => void systemPicker()} onNext={() => void next()} onClose={() => closeRef.current()} onBack={adding ? back : undefined} />;
  return <GestureHandlerRootView style={styles.flex}><SafeAreaView style={[styles.safe, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'canvas') }]}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { borderColor: resolvePresentationColor(theme.divider, 'borderColor', 'content') }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={busy || picking} onPress={back} style={styles.headerAction}><Ionicons name="chevron-back" size={23} color={resolvePresentationColor(colors.accent, 'color', 'content')} /></Pressable>
        <Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{draft.step === 'photos' ? 'Edit media' : 'Journey details'}</Text>
        <View style={styles.headerRight}>{draft.step === 'photos' ? <Pressable accessibilityRole="button" disabled={busy || picking || !draft.photos.length} onPress={() => void next()} style={styles.headerAction}><Text style={presentationTextStyle([styles.blue, !draft.photos.length && styles.disabled])}>Next</Text></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel="Close new journey" disabled={busy || picking} onPress={() => closeRef.current()} style={styles.headerAction}><Ionicons name="close" size={23} color={resolvePresentationColor(colors.accent, 'color', 'content')} /></Pressable></View>
      </View>
      <GestureDetector gesture={editorScroll}><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View key={draft.step} entering={reduceMotion ? undefined : FadeIn.duration(160)} pointerEvents={busy || picking ? 'none' : 'auto'} style={styles.contentStack}>
          {draft.step === 'photos' ? <><Pressable onPress={() => setEditingStops(true)} style={[styles.headerAction, { alignItems: 'flex-start' }]}><Text style={presentationTextStyle(styles.blue)}>Journey stops · {draft.stops?.length ?? 0}</Text></Pressable><PhotoEditingStep scrollGesture={editorScroll} photos={draft.photos} activeKey={activeKey} coverKey={draft.coverKey} theme={theme}
            onVideoEdit={(key, videoEdit) => updatePhoto(key, { videoEdit })}
            onActive={key => { setActiveKey(key); haptic(); }} onCaption={(key, caption) => updatePhoto(key, { caption })} onLocation={key => { Keyboard.dismiss(); setLocationKey(key); }}
            onCover={key => { change({ ...draftRef.current, coverKey: key }); haptic(); }} onMove={(key, offset) => { change({ ...draftRef.current, photos: movePhoto(draftRef.current.photos, key, offset) }); haptic(); }}
            onRemove={key => Alert.alert('Remove photo?', 'Its caption will be removed from this journey.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => change(removeDraftPhoto(draftRef.current, key)) }])}
            onAdd={() => { setAdding(true); change({ ...draftRef.current, step: 'select' }, false); }} onReplace={key => void systemPicker(key)} /></>
            : <JourneyDetailsStep values={draft.values} cover={cover} count={draft.photos.length} theme={theme} onChange={values => change({ ...draftRef.current, values })} />}
        </Animated.View>
      </ScrollView></GestureDetector>
      <View style={[styles.footer, { borderColor: resolvePresentationColor(theme.divider, 'borderColor', 'content') }]}>
        {error ? <ErrorBanner style={{ backgroundColor: resolvePresentationColor(theme.glassStrong, 'backgroundColor', 'content'), borderColor: resolvePresentationColor(theme.border, 'borderColor', 'content') }} textStyle={{ color: theme.ink }} message={error} /> : null}{storageError ? <ErrorBanner style={{ backgroundColor: resolvePresentationColor(theme.glassStrong, 'backgroundColor', 'content'), borderColor: resolvePresentationColor(theme.border, 'borderColor', 'content') }} textStyle={{ color: theme.ink }} message={storageError} /> : null}
        {picking ? <ActivityIndicator color={resolvePresentationColor(colors.accent, 'color', 'content')} /> : null}
        {busy ? <View accessibilityLiveRegion="polite"><Text style={presentationTextStyle([styles.progressLabel, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{progress.label || 'Saving…'} {progress.percent}%</Text><View style={[styles.track, { backgroundColor: resolvePresentationColor(theme.divider, 'backgroundColor', 'content') }]}><View style={[styles.progress, { width: `${progress.percent}%` }]} /></View></View> : null}
        {draft.step === 'details' ? <PrimaryButton style={styles.createButton} loading={busy || picking} disabled={!draft.photos.length} onPress={() => void createJourney()}>Create journey</PrimaryButton> : null}
      </View>
    </KeyboardAvoidingView>
    {editingStops ? <JourneyStopsEditor stops={draft.stops ?? []} media={draft.photos} theme={theme} onClose={() => setEditingStops(false)} onSave={stops => change({ ...draftRef.current, stops, stopsReviewed: true })} /> : null}
    {locationPhoto ? <LocationPicker entityLabel="Photo" latitude={locationPhoto.latitude?.toFixed(6) ?? null} longitude={locationPhoto.longitude?.toFixed(6) ?? null} place={locationPhoto.place} onCancel={() => setLocationKey(null)} onChange={selection => { updatePhoto(locationPhoto.key, { place: selection?.place ?? null, latitude: selection?.coordinate.latitude, longitude: selection?.coordinate.longitude }); setLocationKey(null); }} /> : null}
  </SafeAreaView></GestureHandlerRootView>;
}
const styles = StyleSheet.create({ safe: { flex: 1 }, flex: { flex: 1 }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, header: { minHeight: 56, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth }, headerAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, headerRight: { flexDirection: 'row' }, title: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' }, blue: { color: colors.accent, fontSize: 16, fontWeight: '600' }, content: { padding: 16, paddingBottom: 24 }, contentStack: { gap: 12 }, disabled: { opacity: 0.35 }, footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth }, createButton: { backgroundColor: colors.accent, borderRadius: 16 }, progressLabel: { fontSize: 12, marginBottom: 8 }, track: { height: 3, borderRadius: 2 }, progress: { height: 3, backgroundColor: colors.accent, borderRadius: 2 } });
const presentationBaselineStyles = styles;
