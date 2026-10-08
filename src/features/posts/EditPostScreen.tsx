import { usePresentationStyles, resolvePresentationColor, presentationInterfaceStyle, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoverPicker } from './CoverPicker';
import { beginPostEdit, markPostEditChanged } from './editReturn';

import { JourneyVisibilityField } from '@/features/journeys/components/JourneyVisibilityField';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import type { Journey, JourneyInput, JourneyUpdate } from '@/features/journeys/types';
import { mediaApi } from '@/features/media/api';
import { PhotoUploader } from '@/features/media/components/PhotoUploader';
import { cachedImageSource } from '@/features/media/imageUrl';
import type { JourneyMedia, MediaUpdate } from '@/features/media/types';
import { LocationPicker } from '@/features/places/components/LocationPicker';
import { useProfileTheme } from '@/features/profile/theme';

function journeyValues(journey: Journey): JourneyInput {
  return {
    title: journey.title,
    description: journey.description,
    destination: journey.destination,
    country: journey.country,
    start_date: journey.start_date,
    end_date: journey.end_date,
    visibility: journey.visibility,
    latitude: journey.latitude,
    longitude: journey.longitude,
    place: journey.place,
  };
}

function photoValues(photo: JourneyMedia): MediaUpdate {
  return {
    caption: photo.caption,
    captured_at: photo.captured_at,
    latitude: photo.latitude,
    longitude: photo.longitude,
    place: photo.place,
  };
}

export function changedFields<T extends object>(baseline: T, draft: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(draft).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(baseline[key as keyof T]),
    ),
  ) as Partial<T>;
}

function formatJourneyDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPhotoDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

export function EditPostScreen({ id, action }: { id: string; action?: string }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useProfileTheme();
  const navigation = useNavigation();
  const pendingExit = useRef<(() => void) | null>(null);
  const lock = useRef(false);

  const { fetchOne, update, setCover: persistCover } = useJourneys();

  const [journey, setJourney] = useState<Journey | null>(null);
  const [values, setValues] = useState<JourneyInput | null>(null);
  const [photos, setPhotos] = useState<JourneyMedia[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MediaUpdate>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const openedCoverPicker = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [photoPagerWidth, setPhotoPagerWidth] = useState(0);
  const [showPhotoCount, setShowPhotoCount] = useState(false);
  const photoCountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [locationTarget, setLocationTarget] = useState<string | null>(null);
  const [dateTarget, setDateTarget] = useState<'start_date' | 'end_date' | 'photo' | null>(null);

  useEffect(() => { beginPostEdit(id); }, [id]);

  useEffect(() => {
    let live = true;

    setLoading(true);
    setError(null);

    void Promise.all([fetchOne(id), mediaApi.list(id)])
      .then(([nextJourney, media]) => {
        if (!live) {
          return;
        }

        const list = media.filter(item => item.type === 'photo');

        setJourney(nextJourney);
        setValues(journeyValues(nextJourney));
        setPhotos(list);
        setCover(nextJourney.cover_media_id);
        if (action === 'cover' && list.length && !openedCoverPicker.current) {
          openedCoverPicker.current = true;
          setShowCoverPicker(true);
        }
        setDrafts(Object.fromEntries(list.map(photo => [photo.id, photoValues(photo)])));
        setSelected(list[0]?.id ?? null);
      })
      .catch(nextError => {
        if (live) {
          setError(nextError instanceof Error ? nextError.message : 'Could not open journey.');
        }
      })
      .finally(() => {
        if (live) {
          setLoading(false);
        }
      });

    return () => {
      live = false;
    };
  }, [id, fetchOne, revision, action]);

  const patch: JourneyUpdate =
    journey && values ? changedFields(journeyValues(journey), values) : {};

  const dirty = Boolean(
    journey &&
      (Object.keys(patch).length ||
        photos.some(photo =>
          Object.keys(
            changedFields(
              photoValues(photo),
              drafts[photo.id] ?? photoValues(photo),
            ),
          ).length,
        )),
  );

  const valid = Boolean(
    values?.title.trim() &&
      values.destination.trim() &&
      values.country.trim() &&
      values.start_date <= values.end_date,
  );

  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (finished || (!dirty && !busy && !uploading)) {
          return;
        }

        event.preventDefault();

        if (busy || uploading) {
          Alert.alert('Please wait', 'An upload or save is still in progress.');
          return;
        }

        Alert.alert(
          'Discard unsaved changes?',
          'Uploaded and removed photos and cover changes have already been saved.',
          [
            {
              text: 'Keep Editing',
              style: 'cancel',
            },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                setFinished(true);
                pendingExit.current = () => navigation.dispatch(event.data.action);
              },
            },
          ],
        );
      }),
    [navigation, finished, dirty, busy, uploading],
  );

  useEffect(() => {
    if (!finished) {
      return;
    }

    if (pendingExit.current) {
      const exit = pendingExit.current;
      pendingExit.current = null;
      exit();
      return;
    }

    router.back();
  }, [finished]);

  const current = photos.find(photo => photo.id === selected);
  const draft = current ? drafts[current.id] : undefined;
  const currentIndex = current ? photos.findIndex(photo => photo.id === current.id) : -1;

  const revealPhotoCount = () => {
    if (photoCountTimer.current) {
      clearTimeout(photoCountTimer.current);
    }
    setShowPhotoCount(true);
  };

  const hidePhotoCountSoon = () => {
    if (photoCountTimer.current) {
      clearTimeout(photoCountTimer.current);
    }
    photoCountTimer.current = setTimeout(() => {
      setShowPhotoCount(false);
    }, 650);
  };

  const selectPhotoAtIndex = (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    setSelected(photo.id);
    setDateTarget(null);
  };

  useEffect(() => {
    return () => {
      if (photoCountTimer.current) {
        clearTimeout(photoCountTimer.current);
      }
    };
  }, []);

  const coverPhoto =
    photos.find(photo => photo.id === cover) ??
    photos[0] ??
    null;

  const editPhoto = (next: MediaUpdate) => {
    if (!selected) {
      return;
    }

    setDrafts(all => ({
      ...all,
      [selected]: {
        ...all[selected],
        ...next,
      },
    }));
  };

  async function save() {
    if (!journey || !values || !valid || lock.current || uploading) {
      return;
    }

    lock.current = true;
    setBusy(true);
    setError(null);

    const failures: string[] = [];

    if (Object.keys(patch).length) {
      try {
        const saved = await update(id, patch);
        markPostEditChanged(id);
        setJourney(saved);
        setValues(journeyValues(saved));
      } catch (saveError) {
        failures.push(
          `Journey details: ${
            saveError instanceof Error ? saveError.message : 'Save failed'
          }`,
        );
      }
    }

    for (const photo of photos) {
      const body = changedFields(
        photoValues(photo),
        drafts[photo.id] ?? photoValues(photo),
      );

      if (!Object.keys(body).length) {
        continue;
      }

      try {
        const saved = await mediaApi.update(id, photo.id, body);
        markPostEditChanged(id);

        setPhotos(list =>
          list.map(item => (item.id === saved.id ? saved : item)),
        );

        setDrafts(all => ({
          ...all,
          [saved.id]: photoValues(saved),
        }));
      } catch (saveError) {
        failures.push(
          `Photo ${photos.indexOf(photo) + 1}: ${
            saveError instanceof Error ? saveError.message : 'Save failed'
          }`,
        );
      }
    }

    try {
      await fetchOne(id);
    } catch {
      // Successful mutations remain saved; the journey refetches on focus.
    }

    lock.current = false;
    setBusy(false);

    if (failures.length) {
      setError(
        `${failures.join(
          '\n',
        )}\nYour remaining changes are kept. Tap Save to retry.`,
      );
      return;
    }

    setFinished(true);
  }

  async function changeCover(mediaId: string) {
    if (lock.current || uploading) return;
    if (mediaId === journey?.cover_media_id) {
      setShowCoverPicker(false);
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const saved = await persistCover(id, mediaId);
      setJourney(saved);
      setCover(saved.cover_media_id);
      markPostEditChanged(id);
      setShowCoverPicker(false);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function removePhoto(photo: JourneyMedia) {
    Alert.alert(
      'Delete this photo?',
      'It will be removed permanently from this journey.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (lock.current) {
              return;
            }

            lock.current = true;
            setBusy(true);

            void mediaApi
              .remove(id, photo.id)
              .then(async () => {
                markPostEditChanged(id);
                setPhotos(list =>
                  list.filter(item => item.id !== photo.id),
                );

                setDrafts(all => {
                  const next = { ...all };
                  delete next[photo.id];
                  return next;
                });

                setSelected(
                  photos.find(item => item.id !== photo.id)?.id ?? null,
                );

                const fresh = await fetchOne(id);
                setJourney(fresh);

                if (cover === photo.id) {
                  setCover(fresh.cover_media_id);
                }
              })
              .catch(removeError =>
                setError(
                  removeError instanceof Error
                    ? removeError.message
                    : 'Could not remove photo.',
                ),
              )
              .finally(() => {
                lock.current = false;
                setBusy(false);
              });
          },
        },
      ],
    );
  }

  const headerButton = (
    label: string,
    onPress: () => void,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerButton,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={presentationTextStyle([
          styles.headerButtonText,
          {
            color: resolvePresentationColor(disabled ? '#B8B8BC' : theme.accent, 'color', 'control'),
          },
        ])}
      >
        {label}
      </Text>
    </Pressable>
  );

  const clearCircle = (onPress: () => void, label: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.clearCircle,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="close" size={17} color={resolvePresentationColor("#737378", 'color', 'content')} />
    </Pressable>
  );

  const textField = ({
    label,
    value,
    onChangeText,
    icon,
    multiline = false,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    icon: keyof typeof Ionicons.glyphMap;
    multiline?: boolean;
  }) => (
    <View style={styles.field}>
      <Text style={presentationTextStyle(styles.fieldLabel)}>{label}</Text>

      <View
        style={[
          styles.inputShell,
          multiline && styles.inputShellMultiline,
        ]}
      >
        <Ionicons
          name={icon}
          size={21}
          color={resolvePresentationColor("#111111", 'color', 'content')}
          style={multiline ? styles.multilineIcon : undefined}
        />

        <TextInput
          accessibilityLabel={label}
          editable={!busy && !uploading}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          maxLength={label === 'Journey description' ? 500 : undefined}
          placeholderTextColor={resolvePresentationColor("#A3A3A8", 'placeholderTextColor', 'control')}
          style={presentationTextStyle([
            styles.input,
            multiline && styles.multilineInput,
          ])} keyboardAppearance={presentationInterfaceStyle()}
        />

        {value.length > 0 && !busy && !uploading
          ? clearCircle(
              () => onChangeText(''),
              `Clear ${label.toLowerCase()}`,
            )
          : null}
      </View>
    </View>
  );

  const dateRow = (
    label: string,
    value: string,
    target: 'start_date' | 'end_date',
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${formatJourneyDate(value)}`}
      disabled={busy || uploading}
      onPress={() => setDateTarget(target)}
      style={({ pressed }) => [
        styles.detailRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.detailIcon}>
        <Ionicons name="calendar-outline" size={21} color={resolvePresentationColor("#111111", 'color', 'content')} />
      </View>

      <View style={styles.detailText}>
        <Text style={presentationTextStyle(styles.detailLabel)}>{label}</Text>
        <Text style={presentationTextStyle(styles.detailValue)}>{formatJourneyDate(value)}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={resolvePresentationColor("#C4C4C8", 'color', 'content')} />
    </Pressable>
  );

  const location =
    locationTarget === 'journey'
      ? values
      : locationTarget
        ? drafts[locationTarget]
        : null;

  const dateValue =
    dateTarget === 'photo'
      ? draft?.captured_at
      : dateTarget
        ? values?.[dateTarget]
        : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {headerButton(
          'Cancel',
          () => router.back(),
          busy || uploading,
        )}

        <Text style={presentationTextStyle(styles.headerTitle)}>Edit Journey</Text>

        <View style={styles.headerRight}>
          {dirty && valid && !busy && !uploading ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void save()}
              style={({ pressed }) => [
                styles.savePill,
                pressed && styles.pressed,
              ]}
            >
              <Text style={presentationTextStyle(styles.savePillText)}>Save</Text>
            </Pressable>
          ) : (
            headerButton(
              busy ? 'Saving…' : 'Save',
              () => void save(),
              true,
            )
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {!loading ? <Pressable disabled={busy || uploading} onPress={() => router.push({ pathname: '/journey/[id]/stops', params: { id } })} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>Journey stops →</Text></Pressable> : null}
          {loading ? (
            <Text style={presentationTextStyle(styles.helperText)}>Loading journey…</Text>
          ) : null}

          {error ? (
            <Text accessibilityRole="alert" style={presentationTextStyle({ color: resolvePresentationColor(theme.danger, 'color', 'content') })}>
              {error}
            </Text>
          ) : null}

          {!loading && !journey ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRevision(value => value + 1)}
              style={styles.retryButton}
            >
              <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontWeight: '600' })}>
                Retry
              </Text>
            </Pressable>
          ) : null}

          {journey && values ? (
            <>
              {/* PHOTO MANAGEMENT */}
              <View style={styles.photoSection}>
                {current && draft ? (
                  <>
                    <View
                      style={styles.photoPreviewWrap}
                      onLayout={event => {
                        const width = event.nativeEvent.layout.width;
                        if (width > 0 && width !== photoPagerWidth) {
                          setPhotoPagerWidth(width);
                        }
                      }}
                    >
                      {photoPagerWidth > 0 ? (
                        <ScrollView
                          key={photoPagerWidth}
                          contentOffset={{ x: Math.max(currentIndex, 0) * photoPagerWidth, y: 0 }}
                          contentInsetAdjustmentBehavior="never"
                          automaticallyAdjustContentInsets={false}
                          horizontal
                          pagingEnabled
                          bounces={false}
                          decelerationRate="fast"
                          showsHorizontalScrollIndicator={false}
                          scrollEventThrottle={16}
                          onScrollBeginDrag={revealPhotoCount}
                          onMomentumScrollBegin={revealPhotoCount}
                          onMomentumScrollEnd={event => {
                            if (!photoPagerWidth) return;
                            const nextIndex = Math.round(
                              event.nativeEvent.contentOffset.x / photoPagerWidth,
                            );
                            selectPhotoAtIndex(nextIndex);
                            hidePhotoCountSoon();
                          }}
                          onScrollEndDrag={event => {
                            // If iOS does not start momentum (very short drag), still
                            // update the selected photo and hide the counter shortly.
                            if (!photoPagerWidth) return;
                            const nextIndex = Math.round(
                              event.nativeEvent.contentOffset.x / photoPagerWidth,
                            );
                            selectPhotoAtIndex(nextIndex);
                            hidePhotoCountSoon();
                          }}
                        >
                          {photos.map(photo => (
                            <View
                              key={photo.id}
                              style={[
                                styles.photoPage,
                                { width: photoPagerWidth },
                              ]}
                            >
                              <Image
                                source={cachedImageSource(
                                  photo.url,
                                  `photo-viewer:${photo.id}`,
                                )}
                                style={styles.photoPreview}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                              />
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <Image
                          source={cachedImageSource(current.url, `photo-viewer:${current.id}`)}
                          style={styles.photoPreview}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      )}

                      {showPhotoCount ? (
                        <View pointerEvents="none" style={styles.photoCountBadge}>
                          <Text style={presentationTextStyle(styles.photoCountText)}>
                            {Math.max(currentIndex + 1, 1)} / {photos.length}
                          </Text>
                        </View>
                      ) : null}

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo"
                        disabled={busy || uploading}
                        onPress={() => removePhoto(current)}
                        style={({ pressed }) => [
                          styles.overlayCircle,
                          styles.deleteOverlay,
                          pressed && styles.overlayPressed,
                        ]}
                      >
                        <Ionicons name="trash-outline" size={21} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} />
                      </Pressable>
                    </View>

                    <View pointerEvents={busy ? 'none' : 'auto'}>
                      <PhotoUploader
                        journeyId={id}
                        autoOpen={action === 'add'}
                        onBusyChange={setUploading}
                        renderControls={({ onPress, disabled }) => (
                          <View style={styles.thumbnailStrip}>
                            <ScrollView
                              style={styles.thumbnailScroller}
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.thumbnailRow}
                            >
                              {photos.map((photo, index) => (
                                <Pressable
                                  key={photo.id}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Edit photo ${index + 1}`}
                                  accessibilityState={{ selected: selected === photo.id }}
                                  disabled={busy || uploading}
                                  onPress={() => {
                                    setSelected(photo.id);
                                    setDateTarget(null);
                                  }}
                                  style={[
                                    styles.thumbnail,
                                    selected === photo.id && styles.thumbnailSelected,
                                  ]}
                                >
                                  <Image
                                    source={cachedImageSource(
                                      photo.url,
                                      `photo-viewer:${photo.id}`,
                                    )}
                                    style={styles.fill}
                                    contentFit="cover"
                                    cachePolicy="memory-disk"
                                  />
                                </Pressable>
                              ))}
                            </ScrollView>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Add Photos"
                              accessibilityState={{ disabled: busy || disabled, busy: disabled }}
                              disabled={busy || disabled}
                              onPress={onPress}
                              style={({ pressed }) => [
                                styles.addPhotoButton,
                                (busy || disabled) && styles.addPhotoDisabled,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Ionicons name="add" size={28} color={resolvePresentationColor("#111111", 'color', 'content')} />
                            </Pressable>
                          </View>
                        )}
                        onUploaded={photo => {
                          markPostEditChanged(id);
                          setPhotos(list => [
                            ...list.filter(item => item.id !== photo.id),
                            photo,
                          ]);
                          setDrafts(all => ({
                            ...all,
                            [photo.id]: photoValues(photo),
                          }));
                          setSelected(photo.id);
                          void fetchOne(id).then(fresh => { setJourney(fresh); setCover(fresh.cover_media_id); }).catch(() => undefined);
                        }}
                      />
                    </View>

                    <View style={styles.captionShell}>
                      <View style={styles.captionAvatar}>
                        <Image
                          source={cachedImageSource(
                            current.url,
                            `photo-caption:${current.id}`,
                          )}
                          style={styles.fill}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      </View>
                      <TextInput
                        accessibilityLabel="Caption for this photo"
                        editable={!busy && !uploading}
                        value={draft.caption ?? ''}
                        onChangeText={caption => editPhoto({ caption: caption.slice(0, 100) || null })}
                        maxLength={100}
                        multiline
                        scrollEnabled={false}
                        submitBehavior="newline"
                        placeholder="Write a caption..."
                        placeholderTextColor={resolvePresentationColor("#8E8E93", 'placeholderTextColor', 'control')}
                        style={presentationTextStyle(styles.captionInput)} keyboardAppearance={presentationInterfaceStyle()}
                      />
                      <Text style={presentationTextStyle(styles.captionCounter)}>
                        {(draft.caption ?? '').length}/100
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || uploading}
                      onPress={() => setLocationTarget(current.id)}
                      style={({ pressed }) => [styles.photoRow, pressed && styles.pressed]}
                    >
                      <View style={styles.rowIconCircle}>
                        <Ionicons name="location-outline" size={23} color={resolvePresentationColor("#111111", 'color', 'content')} />
                      </View>
                      <Text style={presentationTextStyle(styles.photoRowText)} numberOfLines={1}>
                        {draft.place?.name ?? 'Add location'}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={resolvePresentationColor("#8E8E93", 'color', 'content')} />
                    </Pressable>

                    <View style={styles.includeRow}>
                      <View style={styles.includeTextWrap}>
                        <Text style={presentationTextStyle(styles.includeTitle)}>Include in journey</Text>
                        <Text style={presentationTextStyle(styles.includeSubtitle)}>
                          This photo will be visible in your journey.
                        </Text>
                      </View>
                      <View style={styles.iosSwitch}>
                        <View style={styles.iosSwitchKnob} />
                      </View>
                    </View>

                    <View style={styles.secondaryPhotoActions}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy || uploading}
                        onPress={() => setShowCoverPicker(true)}
                        style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
                      >
                        <Ionicons
                          name={cover === current.id ? 'star' : 'star-outline'}
                          size={19}
                          color={resolvePresentationColor("#111111", 'color', 'content')}
                        />
                        <Text style={presentationTextStyle(styles.secondaryActionText)}>
                          Change Cover
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy || uploading}
                        onPress={() => setDateTarget('photo')}
                        style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
                      >
                        <Ionicons name="calendar-outline" size={19} color={resolvePresentationColor("#111111", 'color', 'content')} />
                        <Text style={presentationTextStyle(styles.secondaryActionText)}>
                          {draft.captured_at ? formatPhotoDate(draft.captured_at) : 'Photo date'}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <View pointerEvents={busy ? 'none' : 'auto'}>
                    <PhotoUploader
                      journeyId={id}
                      autoOpen={action === 'add'}
                      buttonLabel="+ Add Photos"
                      onBusyChange={setUploading}
                      onUploaded={photo => {
                        markPostEditChanged(id);
                        setPhotos(list => [...list, photo]);
                        setDrafts(all => ({ ...all, [photo.id]: photoValues(photo) }));
                        setSelected(photo.id);
                        void fetchOne(id).then(fresh => { setJourney(fresh); setCover(fresh.cover_media_id); }).catch(() => undefined);
                      }}
                    />
                  </View>
                )}
              </View>

              <View style={styles.sectionDivider} />

              {/* JOURNEY DETAILS */}
              <View style={styles.journeySection}>
                {coverPhoto ? (
                  <View style={styles.coverWrap}>
                    <Image
                      source={cachedImageSource(
                        coverPhoto.url,
                        `journey-cover:${coverPhoto.id}`,
                      )}
                      style={styles.fill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Change journey cover"
                      disabled={busy || uploading}
                      onPress={() => setShowCoverPicker(true)}
                      style={({ pressed }) => [
                        styles.changeCoverButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name="camera"
                        size={18}
                        color={resolvePresentationColor("#111111", 'color', 'content')}
                      />
                      <Text style={presentationTextStyle(styles.changeCoverText)}>
                        Change Cover
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {textField({
                  label: 'Journey title',
                  value: values.title,
                  onChangeText: title =>
                    setValues({
                      ...values,
                      title,
                    }),
                  icon: 'document-text-outline',
                })}

                {textField({
                  label: 'Journey description',
                  value: values.description ?? '',
                  onChangeText: description =>
                    setValues({
                      ...values,
                      description: description || null,
                    }),
                  icon: 'reorder-three-outline',
                  multiline: true,
                })}

                <View style={styles.field}>
                  <Text style={presentationTextStyle(styles.fieldLabel)}>Destination</Text>

                  <View style={styles.detailRow}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || uploading}
                      onPress={() => setLocationTarget('journey')}
                      style={({ pressed }) => [
                        styles.detailRowMain,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.detailIcon}>
                        <Ionicons
                          name="location"
                          size={22}
                          color={resolvePresentationColor("#111111", 'color', 'content')}
                        />
                      </View>

                      <Text
                        numberOfLines={1}
                        style={presentationTextStyle([
                          styles.detailValue,
                          styles.flexOne,
                        ])}
                      >
                        {values.destination ||
                          values.place?.name ||
                          'Choose destination'}
                      </Text>
                    </Pressable>

                    {values.destination && !busy && !uploading
                      ? clearCircle(
                          () =>
                            setValues({
                              ...values,
                              destination: '',
                              country: '',
                              place: null,
                              latitude: null,
                              longitude: null,
                            }),
                          'Clear destination',
                        )
                      : null}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={presentationTextStyle(styles.fieldLabel)}>Country</Text>

                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Ionicons
                        name="globe-outline"
                        size={22}
                        color={resolvePresentationColor("#111111", 'color', 'content')}
                      />
                    </View>

                    <Text
                      numberOfLines={1}
                      style={presentationTextStyle([
                        styles.detailValue,
                        styles.flexOne,
                      ])}
                    >
                      {values.country || 'Country'}
                    </Text>

                    {values.country && !busy && !uploading
                      ? clearCircle(
                          () =>
                            setValues({
                              ...values,
                              country: '',
                            }),
                          'Clear country',
                        )
                      : null}
                  </View>
                </View>

                <View style={styles.dateGroup}>
                  {dateRow(
                    'Start date',
                    values.start_date,
                    'start_date',
                  )}
                  {dateRow(
                    'End date',
                    values.end_date,
                    'end_date',
                  )}
                </View>

                {!valid ? (
                  <Text
                    style={presentationTextStyle([
                      styles.validationText,
                      { color: resolvePresentationColor(theme.danger, 'color', 'content') },
                    ])}
                  >
                    Title, destination and country are required. End date
                    must not precede start date.
                  </Text>
                ) : null}

                <View
                  pointerEvents={
                    busy || uploading ? 'none' : 'auto'
                  }
                  style={styles.visibilityCard}
                >
                  <Text style={presentationTextStyle(styles.visibilityLabel)}>
                    VISIBILITY
                  </Text>

                  <JourneyVisibilityField
                    value={values.visibility ?? 'private'}
                    onChange={visibility =>
                      setValues({
                        ...values,
                        visibility,
                      })
                    }
                  />
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled:
                      !dirty ||
                      !valid ||
                      busy ||
                      uploading,
                  }}
                  disabled={
                    !dirty ||
                    !valid ||
                    busy ||
                    uploading
                  }
                  onPress={() => void save()}
                  style={({ pressed }) => [
                    styles.bottomSave,
                    (!dirty ||
                      !valid ||
                      busy ||
                      uploading) &&
                      styles.bottomSaveDisabled,
                    pressed &&
                      dirty &&
                      valid &&
                      !busy &&
                      !uploading &&
                      styles.pressed,
                  ]}
                >
                  <Text style={presentationTextStyle(styles.bottomSaveText)}>
                    {busy ? 'Saving…' : 'Save Changes'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {dateTarget ? (
            <View style={styles.datePickerCard}>
              <DateTimePicker
                value={
                  dateValue
                    ? new Date(
                        dateValue.length === 10
                          ? `${dateValue}T12:00:00`
                          : dateValue,
                      )
                    : new Date()
                }
                mode="date"
                themeVariant={presentationInterfaceStyle()}
                onChange={(event, date) => {
                  if (Platform.OS !== 'ios') {
                    setDateTarget(null);
                  }

                  if (!date || event.type === 'dismissed') {
                    return;
                  }

                  if (dateTarget === 'photo') {
                    editPhoto({
                      captured_at: date.toISOString(),
                    });
                    return;
                  }

                  if (values) {
                    setValues({
                      ...values,
                      [dateTarget]: `${date.getFullYear()}-${String(
                        date.getMonth() + 1,
                      ).padStart(2, '0')}-${String(
                        date.getDate(),
                      ).padStart(2, '0')}`,
                    });
                  }
                }}
              />

              <Pressable
                accessibilityRole="button"
                onPress={() => setDateTarget(null)}
                style={styles.doneButton}
              >
                <Text
                  style={presentationTextStyle([
                    styles.doneButtonText,
                    { color: resolvePresentationColor(theme.accent, 'color', 'control') },
                  ])}
                >
                  Done
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {showCoverPicker ? (
        <CoverPicker photos={photos} coverId={cover} onCancel={() => setShowCoverPicker(false)} onConfirm={changeCover} />
      ) : null}

      {locationTarget && location ? (
        <LocationPicker
          entityLabel={
            locationTarget === 'journey' ? 'Journey' : 'Photo'
          }
          latitude={location.latitude ?? null}
          longitude={location.longitude ?? null}
          place={location.place ?? null}
          onCancel={() => setLocationTarget(null)}
          onChange={selection => {
            const next = {
              place: selection?.place ?? null,
              latitude: selection
                ? selection.coordinate.latitude.toFixed(6)
                : null,
              longitude: selection
                ? selection.coordinate.longitude.toFixed(6)
                : null,
            };

            if (locationTarget === 'journey' && values) {
              setValues({
                ...values,
                ...next,
                ...(selection?.place
                  ? {
                      destination: selection.place.name,
                      country: selection.place.country,
                    }
                  : {}),
              });
            } else {
              setDrafts(all => ({
                ...all,
                [locationTarget]: {
                  ...all[locationTarget],
                  ...next,
                },
              }));
            }

            setLocationTarget(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  flexOne: {
    flex: 1,
  },

  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    position: 'absolute',
    left: 90,
    right: 90,
    textAlign: 'center',
    color: '#111111',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  headerButton: {
    minWidth: 70,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 17,
    fontWeight: '500',
  },
  headerRight: {
    minWidth: 76,
    alignItems: 'flex-end',
  },
  savePill: {
    minHeight: 42,
    paddingHorizontal: 19,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F95FF',
    shadowColor: '#000000',
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  savePillText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.56,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 42,
  },

  helperText: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
  },

  plusThumbnail: {
    width: 72,
    height: 88,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F6',
  },
  centerHelper: {
    paddingHorizontal: 8,
    color: '#8E8E93',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17,
  },

  moreBadge: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },

  captionIcon: {
    width: 40,
    height: 40,
    marginRight: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F6',
  },
  clearCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F2',
  },
  clearDateAction: {
    minHeight: 42,
    paddingHorizontal: 14,
    gap: 9,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  clearDateText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '500',
  },
  photoActions: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 12,
  },
  photoAction: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 12,
    gap: 8,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F6F8',
  },
  removePhotoAction: {
    backgroundColor: '#FFF0F1',
  },
  photoActionText: {
    color: '#343439',
    fontSize: 15,
    fontWeight: '600',
  },
  removePhotoText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },

  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 32,
    marginBottom: 26,
    backgroundColor: '#E5E5EA',
  },

  journeySection: {
    gap: 18,
  },
  coverWrap: {
    width: '100%',
    aspectRatio: 3.05,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
  },
  changeCoverButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    minHeight: 44,
    paddingHorizontal: 15,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(255,255,255,0.91)',
  },
  changeCoverText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '600',
  },

  field: {
    gap: 8,
  },
  fieldLabel: {
    paddingLeft: 2,
    color: '#74747A',
    fontSize: 14,
    fontWeight: '500',
  },
  inputShell: {
    minHeight: 62,
    paddingHorizontal: 16,
    gap: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1E1E6',
    backgroundColor: '#FFFFFF',
  },
  inputShellMultiline: {
    minHeight: 104,
    alignItems: 'flex-start',
    paddingTop: 17,
    paddingBottom: 14,
  },
  multilineIcon: {
    marginTop: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 0,
    color: '#111111',
    fontSize: 16,
    lineHeight: 21,
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },

  detailRow: {
    minHeight: 66,
    paddingHorizontal: 16,
    gap: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1E1E6',
    backgroundColor: '#FFFFFF',
  },
  detailRowMain: {
    flex: 1,
    minHeight: 64,
    gap: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  detailValue: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '600',
  },
  dateGroup: {
    gap: 11,
  },

  validationText: {
    marginTop: -3,
    fontSize: 13,
    lineHeight: 18,
  },

  visibilityCard: {
    marginTop: 4,
    padding: 16,
    gap: 11,
    borderRadius: 22,
    backgroundColor: '#F7F7F8',
  },
  visibilityLabel: {
    color: '#7B7B80',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.15,
  },

  bottomSave: {
    minHeight: 62,
    marginTop: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F95FF',
  },
  bottomSaveDisabled: {
    opacity: 0.42,
  },
  bottomSaveText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  datePickerCard: {
    marginTop: 22,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#F7F7F8',
  },
  doneButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },


  // Photo management
  photoSection: {
    gap: 18,
  },
  photoPreviewWrap: {
    width: '100%',
    aspectRatio: 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
  },
  photoPage: {
    height: '100%',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoCountBadge: {
    position: 'absolute',
    right: 14,
    top: 14,
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,28,30,0.62)',
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  overlayCircle: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,28,30,0.58)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  previousPhoto: { left: 16, top: '48%' },
  nextPhoto: { right: 16, top: '48%' },
  deleteOverlay: { right: 18, bottom: 18 },
  overlayPressed: { transform: [{ scale: 0.94 }], opacity: 0.78 },
  thumbnailStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thumbnailScroller: {
    flex: 1,
    minWidth: 0,
  },
  addPhotoButton: {
    width: 56,
    height: 88,
    flexShrink: 0,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1E1E6',
    backgroundColor: '#F4F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoDisabled: {
    opacity: 0.5,
  },
  thumbnailRow: {
    gap: 10,
    paddingRight: 8,
    alignItems: 'center',
  },
  thumbnail: {
    width: 76,
    height: 88,
    borderRadius: 12,
    borderWidth: 0,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
  },
  thumbnailSelected: {
    borderWidth: 3,
    borderColor: '#2F95FF',
  },
  captionShell: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: '#F7F7F9',
  },
  captionAvatar: {
    marginTop: 4,
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
  },
  captionInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 14,
    textAlignVertical: 'top',
    color: '#111111',
    fontSize: 16,
    lineHeight: 22,
  },
  captionCounter: {
    paddingTop: 17,
    flexShrink: 0,
    color: '#8E8E93',
    fontSize: 13,
  },
  photoRow: {
    minHeight: 70,
    paddingHorizontal: 14,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#F7F7F9',
  },
  rowIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  photoRowText: {
    flex: 1,
    color: '#111111',
    fontSize: 16,
    fontWeight: '500',
  },
  includeRow: {
    minHeight: 82,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#F7F7F9',
  },
  includeTextWrap: { flex: 1, gap: 3 },
  includeTitle: { color: '#111111', fontSize: 16, fontWeight: '600' },
  includeSubtitle: { color: '#8E8E93', fontSize: 13 },
  iosSwitch: {
    width: 51,
    height: 31,
    padding: 2,
    borderRadius: 16,
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: '#0A84FF',
  },
  iosSwitchKnob: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  secondaryPhotoActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 52,
    gap: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F7F7F9',
  },
  secondaryActionText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '600',
  },
});
const presentationBaselineStyles = styles;
