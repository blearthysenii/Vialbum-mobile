import { usePresentationStyles, resolvePresentationColor, presentationInterfaceStyle, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { requestId } from '@/features/journeys/draft';
import { pickPhotos } from '@/features/media/picker';
import { LocationPicker } from '@/features/places/components/LocationPicker';
import type { ProfileTheme } from '@/features/profile/theme';
import type { PostJourney } from '@/features/posts/data';
import { accommodationTypes, bookedVia, bookingSources, staysApi, type AccommodationType, type BookingSource, type StayInput, type StayPage, type StayPoint, type StaySelection, type StayTip } from './api';
import { clearStayDraft, keepStayPhoto, loadStayDraft, storeStayDraft, type EditorDraft } from './editorDraft';
import { publishStayEditor } from './publishEditor';
import { GlassBackdrop, GlassButton } from './StayGlass';
import { spacing } from '@/theme/spacing';
import { Action, Sheet } from './StayUI';

function Field({ label, children, theme }: { label: string; children: React.ReactNode; theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <View style={styles.field}><Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{label}</Text>{children}</View>;
}
function Selector({ label, icon, theme, disabled, onPress, placeholder = false }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; theme: ProfileTheme; disabled?: boolean; onPress: () => void; placeholder?: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.control, { backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'control'), opacity: pressed ? .7 : disabled ? .65 : 1 }]}><Ionicons name={icon} size={20} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text numberOfLines={2} style={presentationTextStyle({ flex: 1, fontSize: 16, color: resolvePresentationColor(placeholder ? theme.muted : theme.ink, 'color', 'content') })}>{label}</Text><Ionicons name="chevron-forward" size={16} color={resolvePresentationColor(theme.subtle, 'color', 'content')} /></Pressable>;
}
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
export function StayEditor({ journey, destinations, own, initial, theme, onClose, onSaved, onMap }: { journey: PostJourney; destinations: StayPage['destinations']; own: boolean; initial?: StayTip; theme: ProfileTheme; onClose: () => void; onSaved: () => void; onMap: (point: StayPoint) => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { user } = useAuth();
  const [draft, setDraft] = useState<EditorDraft>(() => ({ request_id: requestId(), recommendationId: initial?.id, input: initial ? { name: initial.name, manual_name: initial.manual ? initial.name : undefined, place: initial.place ? { ...initial.place, category: initial.place.category ?? 'accommodation' } : undefined, manual_location: initial.manual ? initial.location ?? undefined : undefined, accommodation_type: initial.accommodation_type, booking_source: initial.booking_source, tip: initial.tip ?? '' } : {}, photos: (initial?.photos ?? []).map(photo => ({ key: photo.id, uri: photo.url, name: 'photo.jpg', mimeType: 'image/jpeg', request_id: requestId(), server: photo })), removed: [] }));
  const [ready, setReady] = useState(false), [query, setQuery] = useState(''), [destination, setDestination] = useState(0), [results, setResults] = useState<StaySelection[]>([]);
  const [chosen, setChosen] = useState(Boolean(initial)), [manual, setManual] = useState(Boolean(initial?.manual)), [review, setReview] = useState(false), [locationOpen, setLocationOpen] = useState(false), [choice, setChoice] = useState<'type' | 'booking'>();
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [picking, setPicking] = useState(false), [error, setError] = useState<string>(), [progress, setProgress] = useState({ label: '', percent: 0 }), [attempt, setAttempt] = useState(0);
  const lock = useRef(false), completed = useRef(false), dirty = useRef(false), state = useRef(draft); state.current = draft;
  useEffect(() => {
    if (!user) return;
    try { const saved = own ? loadStayDraft(user.id, journey.id) : null; if (saved && (!initial || saved.recommendationId === initial.id)) { dirty.current = true; setDraft(saved); setManual(!saved.input.place); setChosen(Boolean(saved.input.place || saved.input.manual_name)); } }
    catch (error) { setError(errorText(error)); } finally { setReady(true); }
  }, [user, journey.id, initial, own]);
  useEffect(() => { if (!ready || !user || !own || completed.current) return; try { storeStayDraft(user.id, journey.id, draft); } catch (error) { setError(`Draft could not be saved: ${errorText(error)}`); } }, [draft, ready, user, journey.id, own]);
  useEffect(() => {
    if (chosen || !ready) return;
    const controller = new AbortController(); setLoading(true); setError(undefined); setResults([]);
    const timer = setTimeout(() => { staysApi.search(journey.id, query, destination, controller.signal).then(items => { if (!controller.signal.aborted) setResults(items); }).catch(error => { if (!controller.signal.aborted) setError(errorText(error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); }, query ? 350 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [journey.id, query, destination, chosen, ready, attempt]);
  const patch = (values: Partial<StayInput> & { name?: string }) => { dirty.current = true; setDraft(value => ({ ...value, input: { ...value.input, ...values } })); };
  const select = (place: StaySelection) => {
    if (!own) { onMap({ id: place.provider_place_id, name: place.name, latitude: Number(place.latitude), longitude: Number(place.longitude) }); return; }
    setManual(false); setChosen(true); patch({ place, manual_name: undefined, manual_city: undefined, manual_location: undefined, name: initial ? place.name : undefined, accommodation_type: ((place.category?.slice(14) ?? '') in accommodationTypes ? place.category?.slice(14) : 'other') as AccommodationType });
  };
  const addPhotos = async (replaceIndex?: number) => {
    if (!user || picking || busy) return;
    const available = replaceIndex === undefined ? 3 - draft.photos.length : 1;
    if (!available) { Alert.alert('Maximum 3 photos', 'Remove or replace a photo to choose another.'); return; }
    setPicking(true); setError(undefined);
    try { const selected = await pickPhotos({ compatible: true, selectionLimit: available }); if (selected.length > available) Alert.alert('Maximum 3 photos', `Only the first ${available} selected photos will be added.`); const kept = await Promise.all(selected.slice(0, available).map(photo => keepStayPhoto(user.id, journey.id, photo))); if (!kept.length) return; dirty.current = true; setDraft(value => { const photos = [...value.photos]; if (replaceIndex === undefined) photos.push(...kept); else photos[replaceIndex] = { ...kept[0], replace_id: photos[replaceIndex].server?.id ?? photos[replaceIndex].replace_id }; return { ...value, photos }; }); }
    catch (error) { setError(errorText(error)); } finally { setPicking(false); }
  };
  const removePhoto = (index: number) => { dirty.current = true; setDraft(value => { const photo = value.photos[index]; return { ...value, photos: value.photos.filter((_, i) => i !== index), removed: [...value.removed, ...(photo.server?.id || photo.replace_id ? [photo.server?.id ?? photo.replace_id!] : [])] }; }); };
  const movePhoto = (index: number, target: number) => { dirty.current = true; setDraft(value => { const photos = [...value.photos]; const [photo] = photos.splice(index, 1); photos.splice(target, 0, photo); return { ...value, photos }; }); void Haptics.selectionAsync().catch(() => {}); };
  const photoMenu = (index: number) => {
    if (busy || picking || lock.current) return;
    const actions = [
      ...(index > 0 ? [{ text: 'Make cover', onPress: () => movePhoto(index, 0) }, { text: 'Move earlier', onPress: () => movePhoto(index, index - 1) }] : []),
      ...(index < draft.photos.length - 1 ? [{ text: 'Move later', onPress: () => movePhoto(index, index + 1) }] : []),
      { text: 'Replace photo', onPress: () => void addPhotos(index) },
      { text: 'Remove photo', style: 'destructive' as const, onPress: () => removePhoto(index) },
    ];
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options: ['Cancel', ...actions.map(action => action.text)], cancelButtonIndex: 0, destructiveButtonIndex: actions.length }, selected => { if (selected > 0 && !lock.current) actions[selected - 1].onPress(); });
    else Alert.alert('Photo options', undefined, [...actions, { text: 'Cancel', style: 'cancel' }]);
  };
  const deleteStay = () => {
    if (!initial || !own || busy || picking || lock.current) return;
    Alert.alert('Delete stay?', 'This recommendation will be removed from your journey.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        if (lock.current || !user) return;
        lock.current = true; setBusy(true); setProgress({ label: 'Deleting stay', percent: 0 }); setError(undefined);
        void staysApi.remove(initial.id).then(() => {
          completed.current = true; clearStayDraft(user.id, journey.id); onSaved();
        }).catch(error => setError(errorText(error))).finally(() => { lock.current = false; setBusy(false); });
      } },
    ]);
  };
  const save = async () => {
    if (!user || !own || lock.current) return; lock.current = true; setBusy(true); setError(undefined);
    try { const complete = await publishStayEditor(journey.id, state.current, value => { state.current = value; setDraft(value); storeStayDraft(user.id, journey.id, value); }, (label, percent) => setProgress({ label, percent })); if (!complete.id || complete.published !== true) throw new Error('The server did not confirm publication.'); completed.current = true; clearStayDraft(user.id, journey.id); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onSaved(); }
    catch (error) { setError(`${errorText(error)} Your edits are kept. Please try again.`); } finally { lock.current = false; setBusy(false); }
  };
  const close = () => {
    if (lock.current || busy || picking) return;
    if (!own || !dirty.current) { onClose(); return; }
    Alert.alert(initial ? 'Keep your changes?' : 'Keep this stay draft?', initial ? 'Your changes have not been saved to this stay.' : 'Closing does not publish your recommendation.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Save draft', onPress: () => {
        if (!user) return;
        try { storeStayDraft(user.id, journey.id, state.current); onClose(); }
        catch (error) { setError(`Draft could not be saved: ${errorText(error)}`); }
      } },
      { text: 'Discard changes', style: 'destructive', onPress: () => {
        if (!user) return;
        lock.current = true; setBusy(true);
        void (async () => {
          const id = state.current.recommendationId;
          if (id && !initial) {
            const rec = await staysApi.owner(id);
            if (rec.published) { completed.current = true; clearStayDraft(user.id, journey.id); onSaved(); return; }
            await staysApi.remove(id);
          }
          completed.current = true; clearStayDraft(user.id, journey.id); onClose();
        })().catch(error => setError(errorText(error))).finally(() => { lock.current = false; setBusy(false); });
      } },
    ]);
  };
  const name = draft.input.name ?? draft.input.manual_name ?? draft.input.place?.name ?? '';
  const location = manual ? draft.input.manual_location : draft.input.place;
  const valid = !!name.trim() && !!draft.input.accommodation_type && !!location;
  const primaryLabel = busy ? 'Saving…' : initial ? 'Save changes' : 'Share stay';
  const style = [styles.input, { color: theme.ink, backgroundColor: theme.elevatedSurface }];
  return <Sheet title={initial ? 'Edit stay' : own ? 'Recommend a stay' : 'Explore stays'} theme={theme} closeLabel="Close" closeDisabled={busy || picking} onClose={close} closeControl={initial ? busy ? <ActivityIndicator accessibilityLabel={progress.label || 'Saving stay'} color={resolvePresentationColor(theme.accent, 'color', 'content')} /> : <Pressable accessibilityRole="button" accessibilityLabel="Done" accessibilityState={{ disabled: !valid || picking || !ready }} disabled={!valid || picking || !ready} onPress={() => { if (dirty.current) void save(); else { if (user) clearStayDraft(user.id, journey.id); onClose(); } }} style={({ pressed }) => [styles.done, { opacity: !valid || picking || !ready || pressed ? .45 : 1 }]}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontSize: 17, fontWeight: '600' })}>Done</Text></Pressable> : <GlassButton label="Close" theme={theme} disabled={busy || picking} onPress={close} radius={22} style={styles.close}><Ionicons name="close" size={22} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></GlassButton>}><ScrollView keyboardDismissMode="interactive" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    {own && !initial?.published ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13, lineHeight: 19 })}>Draft · Not shared yet. Review, then tap Share stay to publish.</Text> : null}
    {!ready ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : !chosen ? <><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 15 })}>{own ? 'Where did you stay on this trip?' : 'Places nearby. These are not verified bookings or traveler recommendations.'}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{destinations.map((item, index) => <Action key={`${item.name}:${item.country}`} label={item.name} theme={theme} onPress={() => setDestination(index)} />)}</ScrollView><TextInput accessibilityLabel="Search accommodation" value={query} onChangeText={setQuery} placeholder="Search hotel, apartment or hostel" placeholderTextColor={resolvePresentationColor(theme.muted, 'placeholderTextColor', 'control')} style={presentationTextStyle(style)} keyboardAppearance={presentationInterfaceStyle()} />{loading ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : null}{results.map(place => <Pressable accessibilityRole="button" key={place.provider_place_id} onPress={() => select(place)} style={styles.result}><Ionicons name="bed-outline" size={24} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><View style={{ flex: 1 }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 17, fontWeight: '600' })}>{place.name}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>{place.locality} · {place.region}</Text></View></Pressable>)}{!loading && !error && !results.length ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>No matching stay. Try another name or add yours manually.</Text> : null}{own ? <><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>Can’t find your stay?</Text><Action label="+ Add manually" theme={theme} onPress={() => { setManual(true); setChosen(true); patch({ place: undefined, accommodation_type: undefined }); }} /></> : null}</> : <>
      {review ? <Action label="Back to editing" theme={theme} disabled={busy} onPress={() => setReview(false)} /> : <GlassButton label="Choose a different stay" theme={theme} accent disabled={busy} onPress={() => setChosen(false)} style={styles.secondary}><Ionicons name="search-outline" size={18} color={resolvePresentationColor(theme.accent, 'color', 'content')} /><Text style={presentationTextStyle([styles.actionText, { color: resolvePresentationColor(theme.accent, 'color', 'content') }])}>Choose a different stay</Text><Ionicons name="chevron-forward" size={15} color={resolvePresentationColor(theme.accent, 'color', 'content')} /></GlassButton>}
      {review ? <><Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{name}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>{accommodationTypes[draft.input.accommodation_type!]} · {location?.name}, {location?.country}</Text>{bookedVia(draft.input.booking_source) ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>{bookedVia(draft.input.booking_source)}</Text> : null}</> : <><Field label="Stay name *" theme={theme}><View style={[styles.control, { backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'control') }]}><Ionicons name="bed-outline" size={20} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><TextInput accessibilityLabel="Stay name" placeholder="e.g. Flat in Cologno Monzese" placeholderTextColor={resolvePresentationColor(theme.muted, 'placeholderTextColor', 'control')} value={name} onChangeText={text => patch(manual ? { manual_name: text, name: initial ? text : undefined } : { name: text })} maxLength={160} editable={!busy} style={presentationTextStyle([styles.nameInput, { color: resolvePresentationColor(theme.ink, 'color', 'control') }])} keyboardAppearance={presentationInterfaceStyle()} /></View></Field>
      <Field label="Accommodation type *" theme={theme}><Selector label={draft.input.accommodation_type ? accommodationTypes[draft.input.accommodation_type] : 'Choose accommodation type'} placeholder={!draft.input.accommodation_type} icon="home-outline" theme={theme} disabled={busy} onPress={() => setChoice('type')} /></Field>
      <Field label="Location *" theme={theme}><Selector label={location ? `${location.name}, ${location.country}` : 'Choose city / destination'} placeholder={!location} icon="location-outline" theme={theme} disabled={busy || !manual} onPress={() => setLocationOpen(true)} /><View style={styles.privacy}><Ionicons name="information-circle-outline" size={15} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13, lineHeight: 19, flex: 1 })}>Only a city or town location is shared. No private address.</Text></View></Field>
      <Field label="Where did you book it? · Optional" theme={theme}><Selector label={draft.input.booking_source ? bookingSources[draft.input.booking_source] : 'Choose booking source'} placeholder={!draft.input.booking_source} icon="calendar-outline" theme={theme} disabled={busy} onPress={() => setChoice('booking')} /></Field></>}

      <View style={styles.sectionHeading}><Text style={presentationTextStyle([styles.sectionTitle, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Photos</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 14 })}>{draft.photos.length} / 3</Text></View>
      <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13, lineHeight: 19 })}>Show travelers what the stay was like. Up to 3 photos; avoid documents, room numbers and private details.</Text>
      {draft.photos.length ? <View style={styles.photos}>{draft.photos.map((photo, index) => <View key={photo.key} style={styles.photoSlot}><Image source={{ uri: photo.uri }} style={[styles.photo, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'media') }]} contentFit="cover" accessibilityLabel={index === 0 ? 'Stay cover photo' : `Stay photo ${index + 1}`} />{index === 0 ? <View pointerEvents="none" style={styles.cover}><GlassBackdrop theme={theme} media radius={10} /><Text style={presentationTextStyle(styles.overlayText)}>Cover</Text></View> : null}{!review ? <GlassButton label={`Options for photo ${index + 1}`} theme={theme} media radius={16} disabled={busy || picking} onPress={() => photoMenu(index)} style={styles.photoMenu}><Ionicons name="ellipsis-horizontal" size={18} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} /></GlassButton> : null}</View>)}</View> : null}
      {!review && draft.photos.length > 1 ? <Pressable accessibilityRole="button" disabled={busy || picking} onPress={() => photoMenu(0)} style={styles.reorder}><Ionicons name="reorder-three-outline" size={18} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 12 })}>Use photo options to reorder</Text></Pressable> : null}
      {!review && draft.photos.length < 3 ? <Pressable accessibilityRole="button" accessibilityLabel={picking ? 'Preparing photos…' : draft.photos.length === 2 ? 'Add photo' : 'Add photos'} disabled={busy || picking} onPress={() => void addPhotos()} style={({ pressed }) => [styles.upload, { backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'control'), opacity: busy || picking || pressed ? .5 : 1 }]}>{picking ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : <Ionicons name="add-circle-outline" size={20} color={resolvePresentationColor(theme.ink, 'color', 'content')} />}<Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 15, fontWeight: '500' })}>{picking ? 'Preparing photos…' : draft.photos.length === 2 ? 'Add photo' : 'Add photos'}</Text></Pressable> : null}
      <View style={[styles.separator, { backgroundColor: resolvePresentationColor(theme.divider, 'backgroundColor', 'content') }]} />
      <Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Your tip · Optional</Text>{review ? draft.input.tip ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 16, lineHeight: 24 })}>“{draft.input.tip}”</Text> : null : <><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13 })}>What should another traveler know?</Text><TextInput accessibilityLabel="Your stay tip" placeholder="Share your experience, tips or anything helpful…" placeholderTextColor={resolvePresentationColor(theme.muted, 'placeholderTextColor', 'control')} multiline value={draft.input.tip ?? ''} onChangeText={tip => patch({ tip })} maxLength={300} editable={!busy} style={presentationTextStyle([...style, { minHeight: 120, textAlignVertical: 'top', lineHeight: 24 }])} keyboardAppearance={presentationInterfaceStyle()} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), textAlign: 'right' })}>{Array.from(draft.input.tip ?? '').length}/300</Text></>}
      {busy ? <View accessibilityLiveRegion="polite"><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>{progress.label} · {progress.percent}%</Text><ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /></View> : null}{!initial ? <GlassButton label={primaryLabel} theme={theme} accent disabled={!valid || busy || picking} onPress={review ? () => void save() : () => setReview(true)} style={styles.cta}><Ionicons name="checkmark-circle-outline" size={20} color={resolvePresentationColor(theme.accent, 'color', 'content')} /><Text style={presentationTextStyle([styles.actionText, { color: resolvePresentationColor(theme.accent, 'color', 'content') }])}>{primaryLabel}</Text><Ionicons name="chevron-forward" size={16} color={resolvePresentationColor(theme.accent, 'color', 'content')} /></GlassButton> : null}
      <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 12 })}>Place data © Geoapify / OpenStreetMap contributors</Text>
      {initial && own ? <><View style={[styles.separator, { backgroundColor: resolvePresentationColor(theme.divider, 'backgroundColor', 'content') }]} /><Pressable accessibilityRole="button" accessibilityLabel="Delete stay" disabled={busy || picking} onPress={deleteStay} style={({ pressed }) => [styles.deleteRow, { opacity: busy || picking || pressed ? .45 : 1 }]}><Ionicons name="trash-outline" size={20} color={resolvePresentationColor(theme.danger, 'color', 'content')} /><Text style={presentationTextStyle({ flex: 1, color: resolvePresentationColor(theme.danger, 'color', 'content'), fontSize: 16 })}>Delete stay</Text><Ionicons name="chevron-forward" size={16} color={resolvePresentationColor(theme.danger, 'color', 'content')} /></Pressable></> : null}
    </>}{error ? <><Text accessibilityRole="alert" style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content') })}>{error}</Text>{!chosen ? <Action label="Retry search" theme={theme} onPress={() => setAttempt(value => value + 1)} /> : null}</> : null}
  </ScrollView>{locationOpen ? <LocationPicker areaOnly entityLabel="Stay city" latitude={location?.latitude ?? null} longitude={location?.longitude ?? null} place={location ?? null} onCancel={() => setLocationOpen(false)} onChange={selection => { patch({ manual_location: selection?.place ?? undefined, manual_city: selection?.place?.name }); setLocationOpen(false); }} /> : null}{choice ? <Sheet title={choice === 'type' ? 'Accommodation type' : 'Where did you book it?'} theme={theme} onClose={() => setChoice(undefined)}><ScrollView contentContainerStyle={styles.content}>{Object.entries(choice === 'type' ? accommodationTypes : bookingSources).map(([value, label]) => <Action key={value} label={`${label}${(choice === 'type' ? draft.input.accommodation_type : draft.input.booking_source) === value ? ' ✓' : ''}`} theme={theme} onPress={() => { patch(choice === 'type' ? { accommodation_type: value as AccommodationType } : { booking_source: value as BookingSource }); setChoice(undefined); }} />)}{choice === 'booking' ? <Action label="Not specified" theme={theme} onPress={() => { patch({ booking_source: null }); setChoice(undefined); }} /> : null}</ScrollView></Sheet> : null}</Sheet>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: spacing.screen, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.sm }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, field: { marginTop: spacing.md, gap: spacing.sm }, label: { fontSize: 15, fontWeight: '600' }, control: { minHeight: 58, borderRadius: 17, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, nameInput: { flex: 1, fontSize: 16, paddingVertical: spacing.md }, privacy: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, secondary: { minHeight: 52, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }, actionText: { flex: 1, fontSize: 15, fontWeight: '600' }, cta: { minHeight: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm }, upload: { minHeight: 48, padding: spacing.sm, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, plus: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, input: { padding: 16, borderRadius: 17, fontSize: 16 }, title: { fontSize: 20, fontWeight: '600', marginTop: spacing.lg }, result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, done: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl }, sectionTitle: { fontSize: 20, fontWeight: '600' }, photoSlot: { flex: 1, minWidth: 0 }, photoMenu: { position: 'absolute', top: 6, right: 6, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, cover: { position: 'absolute', bottom: 6, left: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' }, overlayText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' }, reorder: { minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs }, separator: { height: StyleSheet.hairlineWidth, marginTop: spacing.lg }, deleteRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, photos: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }, photo: { width: '100%', aspectRatio: 1, borderRadius: 14 } });
const presentationBaselineStyles = styles;
