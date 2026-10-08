import { usePresentationStyles, resolvePresentationColor, presentationInterfaceStyle, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Keyboard, Platform, Pressable,
  SectionList, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { ErrorBanner } from '@/components/ui/Feedback';
import { searchApi } from '@/features/search/api';
import { recentSearchStorage } from '@/features/search/storage';
import { useTabBarScroll } from '@/features/navigation/TabBarScrollContext';
import { cachedImageSource } from '@/features/media/imageUrl';
import type { SearchResponse, SearchResult } from '@/features/search/types';
import {
  addRecentSearch, groupSearchResults, normalizeSearchQuery, resultMetadata,
  SEARCH_MIN_LENGTH, searchNavigationTarget,
} from '@/features/search/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/tokens';
import { formatCalendarDate, formatDateRange } from '@/utils/format';

function resultTitle(item: SearchResult) {
  if (item.type === 'journey' || item.type === 'memory') return item.title;
  return item.caption || item.memory_title || 'Journey photo';
}

function resultDetail(item: SearchResult) {
  if (item.type === 'journey') return formatDateRange(item.start_date, item.end_date);
  const location = item.location;
  const context = item.type === 'memory' ? item.context : item.caption;
  return [formatCalendarDate(item.date), location, context].filter(Boolean).join(' · ');
}

const resultIcons = {
  journey: 'airplane-outline',
  memory: 'book-outline',
  photo: 'image-outline',
} as const;

function SearchResultRow({ item, index, reduceMotion }: { item: SearchResult; index: number; reduceMotion: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const thumbnail = item.type === 'journey' || item.type === 'photo' ? item.thumbnail_url : null;
  const title = resultTitle(item);
  const entrance = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) { entrance.setValue(1); return; }
    Animated.timing(entrance, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index * 38, 190),
      useNativeDriver: true,
    }).start();
  }, [entrance, index, reduceMotion]);

  const animatePress = (pressed: boolean) => Animated.timing(pressScale, {
    toValue: pressed ? 0.985 : 1,
    duration: pressed ? 100 : 150,
    useNativeDriver: true,
  }).start();

  return (
    <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { scale: pressScale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.type} result, ${title}, ${resultMetadata(item)}`}
        onPress={() => router.push(searchNavigationTarget(item) as never)}
        onPressIn={() => animatePress(true)}
        onPressOut={() => animatePress(false)}
        style={styles.result}
      >
        <BlurView pointerEvents="none" intensity={36} tint={presentationBlurTint("systemUltraThinMaterialLight")} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.resultTint} />
        <View style={[styles.thumbnail, item.type === 'memory' && styles.memoryThumbnail]}>
          {thumbnail ? (
            <Image source={cachedImageSource(thumbnail, `search:${item.type}:${item.id}`)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" recyclingKey={`search:${item.type}:${item.id}`} />
          ) : <Ionicons name={resultIcons[item.type]} size={21} color={resolvePresentationColor(colors.accent, 'color', 'content')} />}
        </View>
        <View style={styles.resultCopy}>
          <Text numberOfLines={1} style={presentationTextStyle(styles.resultTitle)}>{title}</Text>
          <View style={styles.typeRow}><Ionicons name={resultIcons[item.type]} size={12} color={resolvePresentationColor(colors.accent, 'color', 'content')} /><Text numberOfLines={1} style={presentationTextStyle(styles.resultMeta)}>{resultMetadata(item)}</Text></View>
          <Text numberOfLines={2} style={presentationTextStyle(styles.resultDetail)}>{resultDetail(item)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={resolvePresentationColor(colors.subtle, 'color', 'content')} />
      </Pressable>
    </Animated.View>
  );
}

export default function SearchScreen() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const tabBarScroll = useTabBarScroll();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [focusRefresh, setFocusRefresh] = useState(0);
  const [focused, setFocused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const searchScale = useRef(new Animated.Value(1)).current;
  const normalized = normalizeSearchQuery(query);

  useEffect(() => { void recentSearchStorage.get().then(setRecent); }, []);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  useFocusEffect(useCallback(() => {
    if (normalizeSearchQuery(query).length >= SEARCH_MIN_LENGTH) setFocusRefresh((value) => value + 1);
  }, [query]));

  useEffect(() => {
    requestRef.current?.abort();
    if (normalized.length < SEARCH_MIN_LENGTH) {
      setResponse(null); setError(null); setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = setTimeout(() => {
      setIsLoading(true); setError(null);
      void searchApi.search(normalized, controller.signal)
        .then((result) => setResponse(result))
        .catch((caught) => {
          if (controller.signal.aborted) return;
          setError(caught instanceof ApiError ? caught.message : 'Search is unavailable. Please try again.');
        })
        .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [focusRefresh, normalized, retryKey]);

  const sections = useMemo(() => response ? groupSearchResults(response) : [], [response]);
  const searched = response?.query === normalized;
  const remember = useCallback((value: string) => {
    const next = addRecentSearch(recent, value);
    setRecent(next);
    void recentSearchStorage.set(next);
  }, [recent]);
  const submit = () => {
    if (normalized.length < SEARCH_MIN_LENGTH) return;
    Keyboard.dismiss(); remember(normalized); setRetryKey((value) => value + 1);
  };
  const setSearchFocus = (nextFocused: boolean) => {
    setFocused(nextFocused);
    if (!reduceMotion) Animated.timing(searchScale, { toValue: nextFocused ? 1.008 : 1, duration: 180, useNativeDriver: true }).start();
  };
  const removeRecent = (value: string) => {
    const next = recent.filter((item) => item !== value);
    setRecent(next);
    void recentSearchStorage.set(next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SectionList
        {...tabBarScroll}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        sections={sections}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.content, sections.length === 0 && styles.grow]}
        ListHeaderComponent={<>
          <View style={styles.header}>
            <Text style={presentationTextStyle(styles.headerTitle)}>Search</Text>
          </View>
          <Animated.View style={[styles.searchShell, focused && styles.searchShellFocused, { transform: [{ scale: searchScale }] }]}>
            <BlurView pointerEvents="none" intensity={44} tint={presentationBlurTint("systemUltraThinMaterialLight")} style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={styles.searchTint} />
            <Ionicons name="search" color={resolvePresentationColor(focused ? colors.ink : colors.muted, 'color', 'content')} size={19} />
            <TextInput
              accessibilityLabel="Search journeys, memories, photos, and places"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="never"
              onChangeText={setQuery}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              onSubmitEditing={submit}
              placeholder="Journeys, memories, places…"
              placeholderTextColor={resolvePresentationColor(colors.placeholder, 'placeholderTextColor', 'control')}
              returnKeyType="search"
              value={query}
              style={presentationTextStyle(styles.input)} keyboardAppearance={presentationInterfaceStyle()}
            />
            {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')} style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}><Ionicons name="close-circle" color={resolvePresentationColor(colors.subtle, 'color', 'content')} size={19} /></Pressable> : null}
          </Animated.View>
          {normalized.length === 1 ? <Text style={presentationTextStyle(styles.hint)}>Type one more character to search.</Text> : null}
          {isLoading ? <View accessibilityRole="progressbar" style={styles.loading}><ActivityIndicator color={resolvePresentationColor(colors.muted, 'color', 'content')} size="small" /><Text style={presentationTextStyle(styles.loadingText)}>Searching…</Text></View> : null}
          {!isLoading && error ? <ErrorBanner message={error} onRetry={() => setRetryKey((value) => value + 1)} /> : null}
          {!isLoading && !error && normalized.length < SEARCH_MIN_LENGTH && recent.length > 0 ? (
            <View style={styles.recentBlock}>
              <View style={styles.sectionHeading}><Text style={presentationTextStyle(styles.sectionTitle)}>Recent</Text><Pressable accessibilityRole="button" accessibilityLabel="Clear recent searches" hitSlop={8} onPress={() => { setRecent([]); void recentSearchStorage.clear(); }}><Text style={presentationTextStyle(styles.clearAll)}>Clear all</Text></Pressable></View>
              <View style={styles.recentList}>{recent.map((item) => <View key={item.toLocaleLowerCase()} style={styles.recentRow}><Pressable accessibilityRole="button" accessibilityLabel={`Search for ${item}`} onPress={() => setQuery(item)} style={({ pressed }) => [styles.recentTarget, pressed && styles.pressed]}><View style={styles.recentIcon}><Ionicons name="time-outline" color={resolvePresentationColor(colors.muted, 'color', 'content')} size={18} /></View><Text numberOfLines={1} style={presentationTextStyle(styles.recentText)}>{item}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item} from recent searches`} hitSlop={8} onPress={() => removeRecent(item)} style={({ pressed }) => [styles.recentRemove, pressed && styles.pressed]}><Ionicons name="close" color={resolvePresentationColor(colors.subtle, 'color', 'content')} size={17} /></Pressable></View>)}</View>
            </View>
          ) : null}
        </>}
        ListEmptyComponent={!isLoading && !error ? (
          normalized.length < SEARCH_MIN_LENGTH && recent.length === 0
            ? <View style={styles.empty}><Ionicons name="search-outline" size={22} color={resolvePresentationColor(colors.subtle, 'color', 'content')} /><Text style={presentationTextStyle(styles.emptyTitle)}>Find what you remember.</Text><Text style={presentationTextStyle(styles.emptyCopy)}>Journeys, memories, photographs, and places.</Text></View>
            : searched ? <View style={styles.empty}><Ionicons name="search-outline" size={22} color={resolvePresentationColor(colors.subtle, 'color', 'content')} /><Text style={presentationTextStyle(styles.emptyTitle)}>No results for “{response?.query}”</Text><Text style={presentationTextStyle(styles.emptyCopy)}>Try a destination, memory title, caption, or place.</Text></View> : null
        ) : null}
        renderSectionHeader={({ section }) => <View style={styles.sectionHeading}><Text style={presentationTextStyle(styles.sectionTitle)}>{section.title}</Text><Text style={presentationTextStyle(styles.count)}>{section.data.length}</Text></View>}
        renderItem={({ item, index }) => <SearchResultRow item={item} index={index} reduceMotion={reduceMotion} />}
        SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { paddingHorizontal: spacing.screen, paddingTop: 4, paddingBottom: 140 }, grow: { flexGrow: 1 },
  header: { minHeight: 54, justifyContent: 'center' }, headerTitle: { ...typography.screenTitle, color: colors.ink, fontSize: 32, lineHeight: 37 },
  searchShell: { minHeight: 50, borderRadius: 17, backgroundColor: 'rgba(232,232,237,0.56)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.62)', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, marginTop: 6, overflow: 'hidden' },
  searchShellFocused: { borderColor: 'rgba(0,122,255,0.34)', backgroundColor: 'rgba(255,255,255,0.46)' }, searchTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.12)' },
  input: { flex: 1, color: colors.ink, fontSize: 17, lineHeight: 22, paddingVertical: 10 }, clear: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }, clearPressed: { opacity: 0.56, transform: [{ scale: 0.92 }] },
  hint: { ...typography.metadata, color: colors.muted, marginTop: spacing.sm, paddingHorizontal: spacing.xs }, loading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, loadingText: { ...typography.metadata, color: colors.muted, fontWeight: '500' },
  recentBlock: { marginTop: spacing.lg }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }, sectionTitle: { ...typography.cardTitle, color: colors.ink, fontSize: 19 }, clearAll: { ...typography.body, color: colors.accent, fontSize: 14, fontWeight: '600' }, count: { ...typography.metadata, color: colors.subtle },
  recentList: { borderRadius: 22, backgroundColor: 'rgba(246,246,248,0.72)', paddingHorizontal: 14, overflow: 'hidden' }, recentRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(113,111,104,0.18)' }, recentTarget: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 }, recentIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(118,118,128,0.10)' }, recentText: { ...typography.body, flex: 1, color: colors.ink, fontSize: 16 }, recentRemove: { width: 44, height: 50, alignItems: 'center', justifyContent: 'center' },
  result: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 11, borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.26)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.58)' }, resultTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.08)' }, pressed: { opacity: 0.58 }, thumbnail: { width: 68, height: 68, borderRadius: 17, backgroundColor: 'rgba(232,227,216,0.72)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, memoryThumbnail: { backgroundColor: 'rgba(228,210,199,0.76)' }, resultCopy: { flex: 1, gap: 2 }, resultTitle: { ...typography.cardTitle, fontSize: 17, lineHeight: 22, color: colors.ink }, typeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, resultMeta: { ...typography.metadata, color: colors.accent }, resultDetail: { ...typography.metadata, color: colors.muted, fontWeight: '400', lineHeight: 17 }, sectionGap: { height: 10 },
  empty: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }, emptyTitle: { ...typography.cardTitle, color: colors.ink, fontSize: 19, marginTop: 12, textAlign: 'center' }, emptyCopy: { ...typography.body, color: colors.muted, marginTop: 5, textAlign: 'center', maxWidth: 290 },
});
const presentationBaselineStyles = styles;
