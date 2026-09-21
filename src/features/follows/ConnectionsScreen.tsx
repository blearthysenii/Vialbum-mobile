import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileAvatarImage } from '@/features/profile/components/ProfileAvatarImage';
import { useProfileTheme } from '@/features/profile/theme';
import { DiscoverError } from '@/features/discover/components/DiscoverFeedback';
import { followsApi, type FollowUser } from './api';
import { FollowButton } from './FollowButton';

export function ConnectionsScreen({ kind }: { kind: 'followers' | 'following' }) {
  const theme = useProfileTheme();
  const [items, setItems] = useState<FollowUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const retryCursor = useRef<string | null>(null);
  const load = useCallback(async (after: string | null) => {
    if (busy.current) return;
    busy.current = true;
    retryCursor.current = after;
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(null);
    try {
      const page = await followsApi.people(kind, after, controller.signal);
      if (controller.signal.aborted) return;
      setItems((previous) => [...new Map([...(after ? previous : []), ...page.items].map((item) => [item.id, item])).values()]);
      setCursor(page.next_cursor); setLoaded(true);
    } catch { if (!controller.signal.aborted) setError('Could not load travelers. Please try again.'); }
    finally { if (!controller.signal.aborted) { busy.current = false; setLoading(false); } }
  }, [kind]);
  useFocusEffect(useCallback(() => {
    void load(null);
    return () => { request.current?.abort(); busy.current = false; };
  }, [load]));
  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.canvas }]}>
    <View style={styles.nav}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={25} color={theme.ink} /></Pressable><Text style={[styles.title, { color: theme.ink }]}>{kind === 'followers' ? 'Followers' : 'Following'}</Text><View style={styles.back} /></View>
    <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={styles.content}
      renderItem={({ item }) => <View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.username}'s profile`} onPress={() => router.push(`/public-profile/${item.id}`)} style={styles.person}>
        <ProfileAvatarImage source={item.avatar_url} label={item.username} cacheKey={`creator:${item.id}`} style={styles.avatar} fallbackIconSize={23} /><View style={styles.copy}><Text numberOfLines={1} style={[styles.name, { color: theme.ink }]}>{item.display_name}</Text><Text numberOfLines={1} style={{ color: theme.muted }}>@{item.username}</Text></View>
      </Pressable><FollowButton id={item.id} initial={item.is_following} compact /></View>}
      ListHeaderComponent={error ? <DiscoverError message={error} theme={theme} onRetry={() => void load(retryCursor.current)} /> : null}
      ListEmptyComponent={loaded && !error ? <Text style={[styles.empty, { color: theme.muted }]}>{kind === 'followers' ? 'No followers yet.' : "You're not following anyone yet."}</Text> : null}
      ListFooterComponent={loading ? <ActivityIndicator style={styles.empty} color={theme.muted} /> : null}
      onEndReached={() => { if (cursor && !error) void load(cursor); }} onEndReachedThreshold={0.5}
      refreshing={loading && !cursor} onRefresh={() => void load(null)} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, nav: { height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' }, content: { padding: 18 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }, person: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' }, avatar: { width: 46, height: 46, borderRadius: 23 }, copy: { flex: 1, gap: 4 }, name: { fontSize: 15, fontWeight: '600' }, empty: { padding: 30, textAlign: 'center' } });
