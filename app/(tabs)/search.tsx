import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard, Pressable, SectionList, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/Feedback';
import { searchApi } from '@/features/search/api';
import { recentSearchStorage } from '@/features/search/storage';
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
        sections={sections}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.content, sections.length === 0 && styles.grow]}
        ListHeaderComponent={<>
          <View style={styles.brandRow}><Text style={styles.brand}>Vialbum</Text><Text style={styles.mark}>V</Text></View>
          <Text style={styles.eyebrow}>YOUR PRIVATE LIBRARY</Text>
          <Text style={styles.heading}>Find a moment.</Text>
          <View style={styles.searchBox}>
            <View style={styles.searchIcon} />
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
            {query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')} style={styles.clear}><Text style={styles.clearText}>×</Text></Pressable> : null}
          </View>
          {normalized.length === 1 ? <Text style={styles.hint}>Type one more character to search.</Text> : null}
          {isLoading ? <LoadingState label="Searching your Vialbum…" /> : null}
          {!isLoading && error ? <ErrorBanner message={error} onRetry={() => setRetryKey((value) => value + 1)} /> : null}
          {!isLoading && !error && normalized.length < SEARCH_MIN_LENGTH && recent.length > 0 ? (
            <View style={styles.recentBlock}>
              <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Recent searches</Text><Pressable accessibilityRole="button" onPress={() => { setRecent([]); void recentSearchStorage.clear(); }}><Text style={styles.clearAll}>Clear all</Text></Pressable></View>
              <View style={styles.chips}>{recent.map((item) => <Pressable accessibilityRole="button" accessibilityLabel={`Search for ${item}`} key={item.toLocaleLowerCase()} onPress={() => setQuery(item)} style={styles.chip}><Text style={styles.chipText}>{item}</Text></Pressable>)}</View>
            </View>
          ) : null}
        </>}
        ListEmptyComponent={!isLoading && !error ? (
          normalized.length < SEARCH_MIN_LENGTH && recent.length === 0
            ? <EmptyState title="Everything you saved, close at hand." message="Search journeys, written memories, photo captions, and places from your private library." mark="⌕" />
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
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { paddingHorizontal: spacing.screen, paddingTop: 12, paddingBottom: 40 }, grow: { flexGrow: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }, brand: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.7 }, mark: { color: colors.canvas, backgroundColor: colors.ink, width: 32, height: 32, borderRadius: 16, textAlign: 'center', lineHeight: 32, fontSize: 13, fontWeight: '800' },
  eyebrow: { ...typography.eyebrow, color: colors.accent }, heading: { ...typography.screenTitle, color: colors.ink, marginTop: spacing.xs, marginBottom: spacing.lg },
  searchBox: { minHeight: 56, borderRadius: radii.md, backgroundColor: colors.surfaceWarm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  searchIcon: { width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: colors.muted, marginRight: spacing.sm }, input: { flex: 1, color: colors.ink, fontSize: 17, paddingVertical: 12 }, clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, clearText: { color: colors.muted, fontSize: 28, lineHeight: 30 },
  hint: { ...typography.metadata, color: colors.muted, marginTop: spacing.sm }, recentBlock: { marginTop: spacing.xl }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm }, sectionTitle: { ...typography.cardTitle, color: colors.ink }, clearAll: { ...typography.button, color: colors.accent, fontSize: 13 }, count: { ...typography.metadata, color: colors.subtle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { minHeight: 44, borderRadius: radii.round, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.surface }, chipText: { ...typography.body, color: colors.ink },
  result: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line }, pressed: { opacity: 0.65 }, thumbnail: { width: 68, height: 68, borderRadius: radii.sm, backgroundColor: colors.surfaceWarm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, memoryThumbnail: { backgroundColor: '#E4D2C7' }, placeholder: { color: colors.accent, fontSize: 20, fontWeight: '900' }, resultCopy: { flex: 1, gap: 2 }, resultTitle: { ...typography.cardTitle, fontSize: 17, lineHeight: 22, color: colors.ink }, resultMeta: { ...typography.metadata, color: colors.accent }, resultDetail: { ...typography.metadata, color: colors.muted, fontWeight: '400' }, chevron: { width: 8, height: 8, borderRightWidth: 1.5, borderTopWidth: 1.5, borderColor: colors.subtle, transform: [{ rotate: '45deg' }], marginRight: 3 }, sectionGap: { height: spacing.sm },
});
