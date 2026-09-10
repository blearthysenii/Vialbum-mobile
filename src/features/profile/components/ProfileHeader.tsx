import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';

import type { AuthUser } from '@/features/auth/types';
import type { ProfileTheme } from '@/features/profile/theme';
import { resolveApiImageUrl } from '@/features/media/imageUrl';

export function ProfileStats({ journeys, countries, places, loading, theme }: { journeys: number; countries: number; places: number; loading: boolean; theme: ProfileTheme }) {
  return <View style={styles.stats}>{[['Journeys', journeys], ['Countries', countries], ['Places', places]].map(([label, value]) => <View key={String(label)} style={styles.stat}>{loading ? <View style={[styles.skeleton, { backgroundColor: theme.placeholder }]} /> : <Text style={[styles.statValue, { color: theme.ink }]}>{value}</Text>}<Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text></View>)}</View>;
}

export function ProfileHeader({ user, journeys, countries, places, loading, theme, onAvatarPress }: { user: AuthUser; journeys: number; countries: number; places: number; loading: boolean; theme: ProfileTheme; onAvatarPress: () => void }) {
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase() || 'V';
  const photoUrl = useMemo(() => resolveApiImageUrl(user.profile_photo_url, 'profile_photo_url'), [user.profile_photo_url]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const showPhoto = Boolean(photoUrl && failedUrl !== photoUrl);
  return <View>
    <View style={styles.mainRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" hitSlop={8} onPress={onAvatarPress} style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}>
        <View style={[styles.avatar, { backgroundColor: theme.ink }]}><Text style={[styles.initials, { color: theme.canvas }]}>{initials}</Text>{showPhoto ? <Image source={photoUrl} style={styles.avatarImage} contentFit="cover" cachePolicy="none" onLoadStart={() => setImageLoading(true)} onLoad={() => setImageLoading(false)} onError={(response) => { setImageLoading(false); setFailedUrl(photoUrl); if (__DEV__) console.warn('[Profile image] onError', { url: photoUrl, response }); }} /> : null}{imageLoading ? <View style={styles.avatarLoading}><ActivityIndicator size="small" color="#FFFFFF" /></View> : null}</View>
        <View style={[styles.addBadge, { backgroundColor: theme.accent, borderColor: theme.canvas }]}><Ionicons name="add" size={13} color="#FFFFFF" /></View>
      </Pressable>
      <ProfileStats journeys={journeys} countries={countries} places={places} loading={loading} theme={theme} />
    </View>
    <Text style={[styles.name, { color: theme.ink }]}>{user.first_name} {user.last_name}</Text>
    <Text style={[styles.handle, { color: theme.muted }]}>@{user.username}</Text>
    {user.bio ? <Text style={[styles.bio, { color: theme.ink }]}>{user.bio}</Text> : null}
    {user.location ? <View style={styles.location}><Ionicons name="location-outline" size={13} color={theme.muted} /><Text style={[styles.locationText, { color: theme.muted }]}>{user.location}</Text></View> : null}
  </View>;
}

export function ProfileActions({ theme, onEdit, onShare }: { theme: ProfileTheme; onEdit: () => void; onShare: () => void }) {
  return <View style={styles.actions}>{[{ label: 'Edit Profile', action: onEdit }, { label: 'Share Profile', action: onShare }].map(({ label, action }) => <Pressable key={label} accessibilityRole="button" onPress={action} style={({ pressed }) => [styles.action, { backgroundColor: theme.glass, borderColor: theme.border }, pressed && styles.actionPressed]}><BlurView pointerEvents="none" intensity={theme.dark ? 34 : 26} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /><Text style={[styles.actionText, { color: theme.ink }]}>{label}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  mainRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10 },
  avatarWrap: { width: 84, height: 84 }, avatar: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { position: 'absolute', width: 82, height: 82, borderRadius: 41 }, avatarLoading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.16)' }, initials: { fontSize: 25, fontWeight: '700', letterSpacing: -0.5 },
  addBadge: { position: 'absolute', right: 0, bottom: 2, width: 23, height: 23, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.62, transform: [{ scale: 0.97 }] },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 12 }, stat: { minWidth: 62, alignItems: 'center' }, statValue: { fontSize: 18, lineHeight: 23, fontWeight: '700', letterSpacing: -0.4 }, statLabel: { fontSize: 12, lineHeight: 17, fontWeight: '500' }, skeleton: { width: 28, height: 18, borderRadius: 6, marginBottom: 4 },
  name: { marginTop: 13, paddingHorizontal: 18, fontSize: 15, lineHeight: 20, fontWeight: '700' }, handle: { paddingHorizontal: 18, fontSize: 13, lineHeight: 18, fontWeight: '500' }, bio: { paddingHorizontal: 18, marginTop: 2, fontSize: 14, lineHeight: 20, fontWeight: '400' }, location: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 18, marginTop: 2 }, locationText: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 16 }, action: { flex: 1, height: 38, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' }, actionPressed: { opacity: 0.62, transform: [{ scale: 0.98 }] }, actionText: { fontSize: 13, fontWeight: '600' },
});
