import { usePresentationStyles, resolvePresentationColor, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AuthUser } from '@/features/auth/types';
import type { ProfileTheme } from '@/features/profile/theme';
import { ProfileAvatarImage } from '@/features/profile/components/ProfileAvatarImage';

export function ProfileStats({ journeys, countries, places, loading, theme }: { journeys: number; countries: number; places: number; loading: boolean; theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <View style={styles.stats}>{[['Journeys', journeys], ['Countries', countries], ['Places', places]].map(([label, value]) => <View key={String(label)} style={styles.stat}>{loading ? <View style={[styles.skeleton, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]} /> : <Text style={presentationTextStyle([styles.statValue, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{value}</Text>}<Text style={presentationTextStyle([styles.statLabel, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{label}</Text></View>)}</View>;
}

export function ProfileHeader({ user, journeys, countries, places, loading, theme, onAvatarPress }: { user: AuthUser; journeys: number; countries: number; places: number; loading: boolean; theme: ProfileTheme; onAvatarPress: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <View>
    <View style={styles.mainRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" hitSlop={8} onPress={onAvatarPress} style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}>
        <View style={[styles.avatar, { backgroundColor: resolvePresentationColor(theme.ink, 'backgroundColor', 'content') }]}><ProfileAvatarImage source={user.profile_photo_url} label="profile_photo_url" cacheKey={`profile-header:${user.id}`} style={styles.avatarImage} fallbackIconSize={42} /></View>
        <View style={[styles.addBadge, { backgroundColor: resolvePresentationColor(theme.accent, 'backgroundColor', 'content'), borderColor: resolvePresentationColor(theme.canvas, 'borderColor', 'content') }]}><Ionicons name="add" size={13} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} /></View>
      </Pressable>
      <ProfileStats journeys={journeys} countries={countries} places={places} loading={loading} theme={theme} />
    </View>
    <Text style={presentationTextStyle([styles.name, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{user.first_name} {user.last_name}</Text>
    <Text style={presentationTextStyle([styles.handle, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>@{user.username}</Text>
    {user.bio ? <Text style={presentationTextStyle([styles.bio, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{user.bio}</Text> : null}
    {user.location ? <View style={styles.location}><Ionicons name="location-outline" size={13} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle([styles.locationText, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{user.location}</Text></View> : null}
  </View>;
}

export function ProfileActions({ theme, onEdit, onShare }: { theme: ProfileTheme; onEdit: () => void; onShare: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <View style={styles.actions}>{[{ label: 'Edit Profile', action: onEdit }, { label: 'Share Profile', action: onShare }].map(({ label, action }) => <Pressable key={label} accessibilityRole="button" onPress={action} style={({ pressed }) => [styles.action, { backgroundColor: resolvePresentationColor(theme.glass, 'backgroundColor', 'control'), borderColor: resolvePresentationColor(theme.border, 'borderColor', 'control') }, pressed && styles.actionPressed]}><BlurView pointerEvents="none" intensity={theme.dark ? 34 : 26} tint={presentationBlurTint(theme.dark ? 'dark' : 'light')} style={StyleSheet.absoluteFill} /><Text style={presentationTextStyle([styles.actionText, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{label}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  mainRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10 },
  avatarWrap: { width: 84, height: 84 }, avatar: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { position: 'absolute', width: 82, height: 82, borderRadius: 41 },
  addBadge: { position: 'absolute', right: 0, bottom: 2, width: 23, height: 23, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.62, transform: [{ scale: 0.97 }] },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 12 }, stat: { minWidth: 62, alignItems: 'center' }, statValue: { fontSize: 18, lineHeight: 23, fontWeight: '700', letterSpacing: -0.4 }, statLabel: { fontSize: 12, lineHeight: 17, fontWeight: '500' }, skeleton: { width: 28, height: 18, borderRadius: 6, marginBottom: 4 },
  name: { marginTop: 13, paddingHorizontal: 18, fontSize: 15, lineHeight: 20, fontWeight: '700' }, handle: { paddingHorizontal: 18, fontSize: 13, lineHeight: 18, fontWeight: '500' }, bio: { paddingHorizontal: 18, marginTop: 2, fontSize: 14, lineHeight: 20, fontWeight: '400' }, location: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 18, marginTop: 2 }, locationText: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 16 }, action: { flex: 1, height: 38, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' }, actionPressed: { opacity: 0.62, transform: [{ scale: 0.98 }] }, actionText: { fontSize: 13, fontWeight: '600' },
});
const presentationBaselineStyles = styles;
