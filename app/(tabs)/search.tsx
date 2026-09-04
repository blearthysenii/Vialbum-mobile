import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard, Platform, Pressable, SectionList, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/Feedback';
import { searchApi } from '@/features/search/api';
import { recentSearchStorage } from '@/features/search/storage';
import { useTabBarScroll } from '@/features/navigation/TabBarScrollContext';
import type { SearchResponse, SearchResult } from '@/features/search/types';
import {
  addRecentSearch, groupSearchResults, normalizeSearchQuery, resultMetadata,
  SEARCH_MIN_LENGTH, searchNavigationTarget,
} from '@/features/search/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';
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

function SearchResultRow({ item }: { item: SearchResult }) {
  const thumbnail = item.type === 'journey' || item.type === 'photo' ? item.thumbnail_url : null;
  const title = resultTitle(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.type} result, ${title}, ${resultMetadata(item)}`}
      onPress={() => router.push(searchNavigationTarget(item) as never)}
      style={({ pressed }) => [styles.result, pressed && styles.pressed]}
    >
      <View style={[styles.thumbnail, item.type === 'memory' && styles.memoryThumbnail]}>
        {thumbnail ? (
          <Image source={thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" recyclingKey={`search:${item.type}:${item.id}`} />
        ) : <Text style={styles.placeholder}>{item.type === 'memory' ? 'M' : 'V'}</Text>}
      </View>
      <View style={styles.resultCopy}>
        <Text numberOfLines={1} style={styles.resultTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.resultMeta}>{resultMetadata(item)}</Text>
        <Text numberOfLines={2} style={styles.resultDetail}>{resultDetail(item)}</Text>
      </View>
      <View style={styles.chevron} />
    </Pressable>
  );
}

export default function SearchScreen() {
  const tabBarScroll = useTabBarScroll();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [focusRefresh, setFocusRefresh] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const normalized = normalizeSearchQuery(query);

  useEffect(() => { void recentSearchStorage.get().then(setRecent); }, []);
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
            <Text style={styles.headerTitle}>Search</Text>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" color={colors.muted} size={20} />
            <TextInput
              accessibilityLabel="Search journeys, memories, photos, and places"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="never"
              onChangeText={setQuery}
              onSubmitEditing={submit}
              placeholder="Journeys, memories, places…"
              placeholderTextColor={colors.placeholder}
              returnKeyType="search"
              value={query}
              style={styles.input}
            />
            {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')} style={styles.clear}><Ionicons name="close-circle" color={colors.subtle} size={19} /></Pressable> : null}
          </View>
          {normalized.length === 1 ? <Text style={styles.hint}>Type one more character to search.</Text> : null}
          {isLoading ? <LoadingState label="Searching your Vialbum…" /> : null}
          {!isLoading && error ? <ErrorBanner message={error} onRetry={() => setRetryKey((value) => value + 1)} /> : null}
          {!isLoading && !error && normalized.length < SEARCH_MIN_LENGTH && recent.length > 0 ? (
            <View style={styles.recentBlock}>
              <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Recent</Text><Pressable accessibilityRole="button" accessibilityLabel="Clear recent searches" hitSlop={8} onPress={() => { setRecent([]); void recentSearchStorage.clear(); }}><Text style={styles.clearAll}>Clear all</Text></Pressable></View>
              <View style={styles.recentList}>{recent.map((item) => <Pressable accessibilityRole="button" accessibilityLabel={`Search for ${item}`} key={item.toLocaleLowerCase()} onPress={() => setQuery(item)} style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}><View style={styles.recentIcon}><Ionicons name="time-outline" color={colors.muted} size={19} /></View><Text numberOfLines={1} style={styles.recentText}>{item}</Text><Ionicons name="chevron-forward" color={colors.subtle} size={17} /></Pressable>)}</View>
            </View>
          ) : null}
        </>}
        ListEmptyComponent={!isLoading && !error ? (
          normalized.length < SEARCH_MIN_LENGTH && recent.length === 0
            ? <EmptyState title="Find what you remember." message="Search journeys, memories, photo captions, and places." mark="⌕" />
            : searched ? <EmptyState title={`No results for “${response?.query}”`} message="Try a destination, memory title, photo caption, or place." mark="⌕" /> : null
        ) : null}
        renderSectionHeader={({ section }) => <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.count}>{section.data.length}</Text></View>}
        renderItem={({ item }) => <SearchResultRow item={item} />}
        SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { paddingHorizontal: spacing.screen, paddingTop: 4, paddingBottom: 140 }, grow: { flexGrow: 1 },
  header: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, headerTitle: { ...typography.cardTitle, color: colors.ink, fontSize: 18, lineHeight: 23 },
  searchBox: { minHeight: 48, borderRadius: radii.md, backgroundColor: colors.surfaceWarm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 14, marginTop: spacing.sm },
  input: { flex: 1, color: colors.ink, fontSize: 16, paddingVertical: 10 }, clear: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  hint: { ...typography.metadata, color: colors.muted, marginTop: spacing.sm, paddingHorizontal: spacing.xs }, recentBlock: { marginTop: spacing.lg }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }, sectionTitle: { ...typography.cardTitle, color: colors.ink, fontSize: 18 }, clearAll: { ...typography.button, color: colors.accent, fontSize: 13 }, count: { ...typography.metadata, color: colors.subtle },
  recentList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, recentRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, recentIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceWarm }, recentText: { ...typography.body, flex: 1, color: colors.ink, fontSize: 16 },
  result: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line }, pressed: { opacity: 0.65 }, thumbnail: { width: 68, height: 68, borderRadius: radii.sm, backgroundColor: colors.surfaceWarm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, memoryThumbnail: { backgroundColor: '#E4D2C7' }, placeholder: { color: colors.accent, fontSize: 20, fontWeight: '900' }, resultCopy: { flex: 1, gap: 2 }, resultTitle: { ...typography.cardTitle, fontSize: 17, lineHeight: 22, color: colors.ink }, resultMeta: { ...typography.metadata, color: colors.accent }, resultDetail: { ...typography.metadata, color: colors.muted, fontWeight: '400' }, chevron: { width: 8, height: 8, borderRightWidth: 1.5, borderTopWidth: 1.5, borderColor: colors.subtle, transform: [{ rotate: '45deg' }], marginRight: 3 }, sectionGap: { height: spacing.sm },
});
