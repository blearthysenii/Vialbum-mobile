import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { SecondaryButton } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/Headers';
import { MetadataRow } from '@/components/ui/Metadata';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const initials = `${user?.first_name[0] ?? ''}${user?.last_name[0] ?? ''}`.toUpperCase();

  async function logout() {
    await signOut();
    router.replace('/sign-in');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <ScreenHeader eyebrow="YOUR SPACE" title="Profile" />
        <View style={styles.profile}><View style={styles.avatar}><Text style={styles.initial}>{initials || 'V'}</Text></View>
          <Text style={styles.title}>{user?.first_name} {user?.last_name}</Text><Text style={styles.copy}>A quiet home for the places and moments you want to keep.</Text>
        </View>
        <View style={styles.details}><MetadataRow label="Email" value={user?.email ?? '—'} /></View>
        <SecondaryButton accessibilityLabel="Sign out of Vialbum" onPress={() => void logout()} style={styles.logout}>Sign Out</SecondaryButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { flex: 1, padding: spacing.lg }, profile: { alignItems: 'center', marginTop: spacing.xxl }, avatar: { width: 88, height: 88, borderRadius: radii.round, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, initial: { color: colors.canvas, fontSize: 27, fontWeight: '800' }, title: { ...typography.screenTitle, marginTop: spacing.lg, color: colors.ink }, copy: { ...typography.bodyLarge, maxWidth: 300, marginTop: spacing.md, textAlign: 'center', color: colors.muted }, details: { marginTop: spacing.xxl }, logout: { marginTop: 'auto', marginBottom: spacing.lg } });
