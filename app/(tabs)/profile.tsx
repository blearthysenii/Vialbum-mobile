import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/colors';

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
        <View style={styles.avatar}><Text style={styles.initial}>{initials || 'V'}</Text></View>
        <Text style={styles.title}>{user?.first_name} {user?.last_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.copy}>A quiet home for the places and moments you want to keep.</Text>
        <Pressable onPress={logout} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}><Text style={styles.logoutText}>Sign Out</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }, avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, initial: { color: colors.canvas, fontSize: 27, fontWeight: '800' }, title: { marginTop: 24, fontSize: 30, fontWeight: '800', color: colors.ink }, email: { color: colors.muted, marginTop: 5, fontSize: 14 }, copy: { maxWidth: 280, marginTop: 18, textAlign: 'center', color: colors.muted, fontSize: 16, lineHeight: 24 }, logout: { marginTop: 36, borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14 }, pressed: { opacity: 0.65 }, logoutText: { color: colors.accent, fontSize: 14, fontWeight: '800' } });
