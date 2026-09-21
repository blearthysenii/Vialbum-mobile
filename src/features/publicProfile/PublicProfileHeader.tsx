import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { ProfileCover } from '@/features/profile/components/ProfileCover';
import { ProfileAvatarImage } from '@/features/profile/components/ProfileAvatarImage';
import { useProfileTheme } from '@/features/profile/theme';
import { FollowButton } from '@/features/follows/FollowButton';
import type { PublicProfile } from './api';

export function PublicProfileHeader({ profile }: { profile: PublicProfile }) {
  const theme = useProfileTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return <View>
    <View style={styles.hero}>
      <ProfileCover source={profile.cover_url} canvas={theme.canvas} dark={theme.dark} reduceMotion={reduceMotion} />
      <Text style={[styles.motto, { top: insets.top + 68 }]}>Explore{'\n'}Capture{'\n'}Remember</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={[styles.back, { top: insets.top + 12 }]}>
        <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
    <View style={styles.identity}>
      <View style={[styles.avatarFrame, { borderColor: theme.canvas }]}><ProfileAvatarImage source={profile.avatar_url} label={profile.username} cacheKey={`public-profile:${profile.id}`} style={styles.avatar} fallbackIconSize={54} /></View>
      <Text style={[styles.name, { color: theme.ink }]}>{profile.display_name}</Text>
      <Text style={[styles.username, { color: theme.muted }]}>@{profile.username}</Text>
      {profile.bio ? <Text style={[styles.bio, { color: theme.ink }]}>{profile.bio}</Text> : null}
      {profile.location ? <Text style={[styles.location, { color: theme.muted }]}><Ionicons name="location-outline" size={14} /> {profile.location}</Text> : null}
      <View style={styles.action}><FollowButton id={profile.id} initial={profile.is_following} /></View>
    </View>
    <View style={[styles.divider, { backgroundColor: theme.border }]} />
    <Text style={[styles.section, { color: theme.ink }]}>Journeys</Text>
  </View>;
}
const styles = StyleSheet.create({
  hero: { height: 260 }, motto: { position: 'absolute', left: 34, color: '#FFFFFF', fontFamily: 'System', fontSize: 15, lineHeight: 21, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.34)', textShadowRadius: 7, textShadowOffset: { width: 0, height: 1 } },
  back: { position: 'absolute', left: 20, width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  identity: { alignItems: 'center', paddingHorizontal: 28, marginTop: -108 }, avatarFrame: { width: 108, height: 108, borderRadius: 54, borderWidth: 3, overflow: 'hidden', marginBottom: 12 }, avatar: { width: '100%', height: '100%' },
  name: { fontFamily: 'System', fontSize: 28, fontWeight: '700', letterSpacing: -0.8, textAlign: 'center' }, username: { fontSize: 15, lineHeight: 20, fontWeight: '500', letterSpacing: -0.2, marginTop: 4 },
  bio: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 }, location: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 }, action: { marginTop: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginTop: 24 }, section: { fontSize: 23, fontWeight: '700', letterSpacing: -0.6, marginHorizontal: 20, marginTop: 28, marginBottom: 14 },
});
