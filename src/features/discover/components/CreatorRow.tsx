import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ProfileAvatarImage } from '@/features/profile/components/ProfileAvatarImage';
import type { ProfileTheme } from '@/features/profile/theme';
import type { PublicCreator } from '../types';

export const CreatorRow = memo(function CreatorRow({ creator, theme, overlay = false }: { creator: PublicCreator; theme: ProfileTheme; overlay?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${creator.username}'s public profile`} hitSlop={4} onPress={(event) => { event.stopPropagation(); router.push(`/public-profile/${creator.id}`); }} style={styles.row}>
    <ProfileAvatarImage source={creator.avatar_url} label={creator.username} cacheKey={`creator:${creator.id}`} style={styles.avatar} fallbackIconSize={13} />
    <Text numberOfLines={1} style={[styles.name, { color: overlay ? '#FFFFFF' : theme.muted }]}>{overlay ? '@' : ''}{creator.username}</Text>
  </Pressable>;
});
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  avatar: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 11, fontWeight: '600' }, name: { flex: 1, fontSize: 12, fontWeight: '500' },
});
