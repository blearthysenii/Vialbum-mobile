import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { authApi } from '@/features/auth/api';
import { useProfileTheme } from '@/features/profile/theme';

type PickedPhoto = { uri: string; name: string; type: string };
type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'username' | 'bio' | 'location' | 'form', string>>;

export default function EditProfileScreen() {
  const { user, updateProfile, refreshUser } = useAuth();
  const theme = useProfileTheme();
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheck = useRef(0);

  const normalized = username.trim().toLowerCase();
  const dirty = Boolean(user && (firstName !== user.first_name || lastName !== user.last_name || normalized !== user.username || bio !== (user.bio ?? '') || location !== (user.location ?? '') || photo || removePhoto));
  useEffect(() => { const subscription = BackHandler.addEventListener('hardwareBackPress', () => { requestClose(); return true; }); return () => subscription.remove(); });
  if (!user) return null;

  function clearError(field: keyof FieldErrors) { setErrors((current) => ({ ...current, [field]: undefined, form: undefined })); }
  function requestClose() {
    if (!dirty || saving) { if (!saving) router.back(); return; }
    Alert.alert('Discard Changes?', 'Your profile changes haven’t been saved.', [{ text: 'Keep Editing', style: 'cancel' }, { text: 'Discard Changes', style: 'destructive', onPress: () => router.back() }]);
  }
  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo access in Settings to choose a profile photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, name: asset.fileName ?? 'profile-photo.jpg', type: asset.mimeType ?? 'image/jpeg' });
    setRemovePhoto(false);
  }
  async function checkUsername() {
    clearError('username');
    if (normalized === user!.username || !/^[a-z0-9_]{3,30}$/.test(normalized)) return true;
    const request = ++usernameCheck.current;
    setCheckingUsername(true);
    try {
      const result = await authApi.usernameExists(normalized);
      if (request !== usernameCheck.current) return false;
      if (result.exists) { setErrors((current) => ({ ...current, username: 'This username is already taken.' })); return false; }
      return true;
    } catch { return true; } finally { if (request === usernameCheck.current) setCheckingUsername(false); }
  }
  function validate() {
    const next: FieldErrors = {};
    const first = firstName.trim(); const last = lastName.trim();
    if (!first || first.length > 50) next.firstName = 'First name must be between 1 and 50 characters.';
    if (!last || last.length > 50) next.lastName = 'Last name must be between 1 and 50 characters.';
    if (!/^[a-z0-9_]{3,30}$/.test(normalized)) next.username = 'Use 3–30 lowercase letters, numbers, or underscores.';
    if (bio.trim().length > 150) next.bio = 'Bio must be 150 characters or fewer.';
    if (location.trim().length > 100) next.location = 'Location must be 100 characters or fewer.';
    setErrors(next); return Object.keys(next).length === 0;
  }
  async function save() {
    if (saving || !dirty || !validate() || !(await checkUsername())) return;
    setSaving(true);
    try {
      await updateProfile({ first_name: firstName.trim(), last_name: lastName.trim(), username: normalized, bio: bio.trim() || null, location: location.trim() || null });
      if (photo) await authApi.uploadProfilePhoto(photo, () => undefined);
      else if (removePhoto) await authApi.removeProfilePhoto();
      await refreshUser();
      router.back();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'USERNAME_TAKEN') setErrors((current) => ({ ...current, username: 'This username is already taken.' }));
      else setErrors((current) => ({ ...current, form: error instanceof Error ? error.message : 'Your profile could not be saved.' }));
    } finally { setSaving(false); }
  }

  const preview = photo?.uri ?? (!removePhoto ? user.profile_photo_url : null);
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || 'V';
  const fields = [{ key: 'firstName' as const, label: 'First name', value: firstName, set: setFirstName, max: 50 }, { key: 'lastName' as const, label: 'Last name', value: lastName, set: setLastName, max: 50 }, { key: 'username' as const, label: 'Username', value: username, set: (value: string) => setUsername(value.toLowerCase()), max: 30 }, { key: 'bio' as const, label: 'Bio', value: bio, set: setBio, max: 150 }, { key: 'location' as const, label: 'Location', value: location, set: setLocation, max: 100 }];
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.canvas }]}><KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.nav}><Pressable disabled={saving} onPress={requestClose} style={styles.navButton}><Text style={[styles.navAction, { color: theme.accent }]}>Cancel</Text></Pressable><Text style={[styles.title, { color: theme.ink }]}>Edit Profile</Text><Pressable disabled={!dirty || saving} onPress={() => void save()} style={[styles.navButton, styles.save]}>{saving ? <ActivityIndicator size="small" color={theme.accent} /> : <Text style={[styles.navAction, styles.saveText, { color: theme.accent }, !dirty && styles.disabled]}>Save</Text>}</Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}><Pressable onPress={() => void pickPhoto()} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}><View style={[styles.avatar, { backgroundColor: theme.ink }]}>{preview ? <Image source={preview} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="none" /> : <Text style={[styles.initials, { color: theme.canvas }]}>{initials}</Text>}</View><Text style={[styles.photoAction, { color: theme.accent }]}>Change Profile Photo</Text></Pressable>{user.profile_photo_url && !removePhoto ? <Pressable onPress={() => { setPhoto(null); setRemovePhoto(true); }} style={({ pressed }) => pressed && styles.pressed}><Text style={[styles.removePhoto, { color: theme.danger }]}>Remove Current Photo</Text></Pressable> : null}</View>
      <View style={[styles.form, { backgroundColor: theme.glass, borderColor: theme.border }]}><BlurView pointerEvents="none" intensity={theme.dark ? 34 : 24} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />{fields.map((field, index) => <View key={field.key}><View style={[styles.field, index > 0 && { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth }, field.key === 'bio' && styles.bioField]}><Text style={[styles.label, { color: theme.muted }]}>{field.label}</Text><TextInput value={field.value} onChangeText={(value) => { field.set(value); clearError(field.key); if (field.key === 'username') usernameCheck.current += 1; }} onBlur={field.key === 'username' ? () => void checkUsername() : undefined} maxLength={field.max} multiline={field.key === 'bio'} autoCapitalize={field.key === 'username' ? 'none' : 'sentences'} autoCorrect={field.key !== 'username'} placeholder={field.key === 'bio' || field.key === 'location' ? 'Optional' : undefined} placeholderTextColor={theme.subtle} style={[styles.input, field.key === 'bio' && styles.bioInput, { color: theme.ink }]} />{field.key === 'username' && checkingUsername ? <ActivityIndicator size="small" color={theme.muted} /> : null}</View>{errors[field.key] ? <Text style={[styles.fieldError, { color: theme.danger }]}>{errors[field.key]}</Text> : null}{field.key === 'bio' ? <Text style={[styles.counter, { color: theme.muted }]}>{bio.length}/150</Text> : null}</View>)}</View>
      {errors.form ? <Text style={[styles.formError, { color: theme.danger }]}>{errors.form}</Text> : null}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, nav: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, navButton: { position: 'absolute', left: 10, minWidth: 64, height: 44, justifyContent: 'center' }, save: { left: undefined, right: 10, alignItems: 'flex-end' }, title: { fontFamily: 'System', fontSize: 17, fontWeight: '700' }, navAction: { fontFamily: 'System', fontSize: 16 }, saveText: { fontWeight: '600' }, disabled: { opacity: 0.36 }, content: { paddingBottom: 40 }, avatarSection: { alignItems: 'center', paddingVertical: 20 }, avatarButton: { alignItems: 'center' }, avatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, initials: { fontSize: 27, fontWeight: '700' }, photoAction: { marginTop: 10, fontSize: 14, fontWeight: '600' }, removePhoto: { marginTop: 8, fontSize: 13, fontWeight: '500' }, pressed: { opacity: 0.52, transform: [{ scale: 0.97 }] }, form: { marginHorizontal: 18, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' }, field: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 }, bioField: { minHeight: 86, alignItems: 'flex-start', paddingTop: 17 }, label: { width: 82, fontSize: 13, fontWeight: '500' }, input: { flex: 1, fontSize: 15, paddingVertical: 0 }, bioInput: { minHeight: 56, textAlignVertical: 'top' }, fieldError: { fontSize: 11, lineHeight: 15, marginLeft: 110, marginRight: 14, marginTop: -5, marginBottom: 7 }, counter: { alignSelf: 'flex-end', marginRight: 14, marginTop: -18, marginBottom: 6, fontSize: 10 }, formError: { marginHorizontal: 24, marginTop: 12, fontSize: 12, textAlign: 'center' } });
