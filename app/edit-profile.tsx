import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { authApi } from '@/features/auth/api';
import { cachedImageSource } from '@/features/media/imageUrl';
import { ProfileAvatarImage } from '@/features/profile/components/ProfileAvatarImage';
import { useProfileTheme } from '@/features/profile/theme';
import { systemFont } from '@/theme/tokens';

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
  const [cover, setCover] = useState<PickedPhoto | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheck = useRef(0);

  const normalized = username.trim().toLowerCase();
  const dirty = Boolean(user && (firstName !== user.first_name || lastName !== user.last_name || normalized !== user.username || bio !== (user.bio ?? '') || location !== (user.location ?? '') || photo || removePhoto || cover || removeCover));
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
  async function pickCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo access in Settings to choose a profile cover.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.9 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setCover({ uri: asset.uri, name: asset.fileName ?? 'profile-cover.jpg', type: asset.mimeType ?? 'image/jpeg' });
    setRemoveCover(false);
  }
  function showPhotoActions() {
    const canRemove = Boolean(photo || (user?.profile_photo_url && !removePhoto));
    const options = canRemove ? ['Change Profile Photo', 'Remove Current Photo', 'Cancel'] : ['Change Profile Photo', 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: canRemove ? 1 : undefined }, (index) => {
        if (index === 0) void pickPhoto();
        else if (canRemove && index === 1) { setPhoto(null); setRemovePhoto(true); }
      });
      return;
    }
    Alert.alert('Profile Photo', undefined, [
      { text: 'Change Profile Photo', onPress: () => void pickPhoto() },
      ...(canRemove ? [{ text: 'Remove Current Photo', style: 'destructive' as const, onPress: () => { setPhoto(null); setRemovePhoto(true); } }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  function showCoverActions() {
    const canRemove = Boolean(cover || (user?.profile_cover_url && !removeCover));
    const options = canRemove ? ['Change Cover Photo', 'Remove Current Cover', 'Cancel'] : ['Change Cover Photo', 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: canRemove ? 1 : undefined }, (index) => {
        if (index === 0) void pickCover();
        else if (canRemove && index === 1) { setCover(null); setRemoveCover(true); }
      });
      return;
    }
    Alert.alert('Cover Photo', undefined, [
      { text: 'Change Cover Photo', onPress: () => void pickCover() },
      ...(canRemove ? [{ text: 'Remove Current Cover', style: 'destructive' as const, onPress: () => { setCover(null); setRemoveCover(true); } }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
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
      if (cover) await authApi.uploadProfileCover(cover, () => undefined);
      else if (removeCover) await authApi.removeProfileCover();
      await refreshUser();
      router.back();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'USERNAME_TAKEN') setErrors((current) => ({ ...current, username: 'This username is already taken.' }));
      else setErrors((current) => ({ ...current, form: error instanceof Error ? error.message : 'Your profile could not be saved.' }));
    } finally { setSaving(false); }
  }

  const preview = photo?.uri ?? (!removePhoto ? user.profile_photo_url : null);
  const coverPreview = cover?.uri ?? (!removeCover ? user.profile_cover_url : null);
  const fields = [{ key: 'firstName' as const, label: 'First name', value: firstName, set: setFirstName, max: 50 }, { key: 'lastName' as const, label: 'Last name', value: lastName, set: setLastName, max: 50 }, { key: 'username' as const, label: 'Username', value: username, set: (value: string) => setUsername(value.toLowerCase()), max: 30 }];
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.canvas }]}><KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.nav, { backgroundColor: theme.glass, borderColor: theme.border }]}><BlurView pointerEvents="none" intensity={theme.dark ? 42 : 30} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /><Pressable disabled={saving} hitSlop={6} onPress={requestClose} style={({ pressed }) => [styles.navButton, pressed && styles.actionPressed]}><Text style={[styles.navAction, { color: theme.accent }]}>Cancel</Text></Pressable><Text style={[styles.title, { color: theme.ink }]}>Edit Profile</Text><Pressable disabled={!dirty || saving} hitSlop={6} onPress={() => void save()} style={({ pressed }) => [styles.navButton, styles.save, pressed && dirty && styles.actionPressed]}>{saving ? <ActivityIndicator size="small" color={theme.accent} /> : <Text style={[styles.navAction, styles.saveText, { color: theme.accent }, !dirty && styles.disabled]}>Save</Text>}</Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.mediaComposition}>
        <View style={[styles.coverButton, { backgroundColor: theme.glassStrong }]}>
          {coverPreview ? <Image source={cachedImageSource(coverPreview, `edit-profile-cover:${user.id}`)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" transition={180} /> : <View style={styles.coverPlaceholder}><Ionicons name="image-outline" size={23} color={theme.subtle} /><Text style={[styles.coverPlaceholderText, { color: theme.muted }]}>Choose a profile cover</Text></View>}
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile cover photo" hitSlop={8} onPress={showCoverActions} style={({ pressed }) => [styles.coverCamera, { borderColor: theme.border }, pressed && styles.cameraPressed]}><BlurView pointerEvents="none" intensity={theme.dark ? 48 : 36} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /><Ionicons name="camera-outline" size={18} color={theme.ink} /></Pressable>
        </View>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatarRing, { backgroundColor: theme.canvas }]}><View style={[styles.avatar, { backgroundColor: theme.ink }]}><ProfileAvatarImage source={preview} label="edit-profile-avatar" cacheKey={`edit-profile-avatar:${user.id}`} style={StyleSheet.absoluteFill} fallbackIconSize={48} /></View></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile photo" hitSlop={8} onPress={showPhotoActions} style={({ pressed }) => [styles.avatarCamera, { backgroundColor: theme.glassStrong, borderColor: theme.canvas }, pressed && styles.cameraPressed]}><Ionicons name="camera-outline" size={16} color={theme.ink} /></Pressable>
        </View>
      </View>
      <View style={[styles.form, { backgroundColor: theme.glassStrong, borderColor: theme.border }]}>{fields.map((field, index) => <View key={field.key}><View style={[styles.field, index > 0 && { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth }]}><Text style={[styles.label, { color: theme.muted }]}>{field.label}</Text><TextInput value={field.value} onChangeText={(value) => { field.set(value); clearError(field.key); if (field.key === 'username') usernameCheck.current += 1; }} onBlur={field.key === 'username' ? () => void checkUsername() : undefined} maxLength={field.max} autoCapitalize={field.key === 'username' ? 'none' : 'words'} autoCorrect={field.key !== 'username'} style={[styles.input, { color: theme.ink }]} />{field.key === 'username' && checkingUsername ? <ActivityIndicator size="small" color={theme.muted} /> : null}</View>{errors[field.key] ? <Text style={[styles.fieldError, { color: theme.danger }]}>{errors[field.key]}</Text> : null}</View>)}</View>
      <View style={[styles.bioCard, { backgroundColor: theme.glassStrong, borderColor: theme.border }]}><Text style={[styles.cardLabel, { color: theme.muted }]}>Bio</Text><TextInput value={bio} onChangeText={(value) => { setBio(value); clearError('bio'); }} maxLength={150} multiline autoCapitalize="sentences" autoCorrect placeholder="Share something about yourself…" placeholderTextColor={theme.subtle} style={[styles.bioInput, { color: theme.ink }]} textAlignVertical="top" /><Text style={[styles.counter, { color: bio.length >= 140 ? theme.danger : theme.muted }]}>{bio.length}/150</Text></View>
      {errors.bio ? <Text style={[styles.cardError, { color: theme.danger }]}>{errors.bio}</Text> : null}
      <View style={[styles.locationCard, { backgroundColor: theme.glassStrong, borderColor: theme.border }]}><Ionicons name="location-outline" size={20} color={theme.muted} /><View style={styles.locationContent}><Text style={[styles.locationLabel, { color: theme.muted }]}>Location</Text><TextInput value={location} onChangeText={(value) => { setLocation(value); clearError('location'); }} maxLength={100} autoCapitalize="words" autoCorrect placeholder="Optional" placeholderTextColor={theme.subtle} returnKeyType="done" style={[styles.locationInput, { color: theme.ink }]} /></View><Ionicons name="chevron-forward" size={17} color={theme.subtle} /></View>
      {errors.location ? <Text style={[styles.cardError, { color: theme.danger }]}>{errors.location}</Text> : null}
      {errors.form ? <Text style={[styles.formError, { color: theme.danger }]}>{errors.form}</Text> : null}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  nav: { height: 58, marginTop: 8, marginHorizontal: 12, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, overflow: 'hidden' },
  navButton: { position: 'absolute', left: 10, minWidth: 64, height: 44, justifyContent: 'center' },
  save: { left: undefined, right: 10, alignItems: 'flex-end' },
  title: { fontFamily: systemFont, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.35 },
  navAction: { fontFamily: systemFont, fontSize: 16, lineHeight: 21, fontWeight: '400' },
  saveText: { fontWeight: '600' },
  disabled: { opacity: 0.34 },
  actionPressed: { opacity: 0.52 },
  content: { paddingTop: 14, paddingBottom: 64 },
  mediaComposition: { marginHorizontal: 18, marginBottom: 32 },
  coverButton: { height: 178, borderRadius: 26, overflow: 'hidden' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7 },
  coverPlaceholderText: { fontFamily: systemFont, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  coverCamera: { position: 'absolute', right: 12, bottom: 12, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  avatarWrap: { alignSelf: 'center', width: 102, height: 102, marginTop: -49 },
  avatarRing: { width: 102, height: 102, borderRadius: 51, padding: 4, shadowColor: '#000000', shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  avatar: { flex: 1, borderRadius: 47, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarCamera: { position: 'absolute', right: -2, bottom: 3, width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  cameraPressed: { opacity: 0.58, transform: [{ scale: 0.96 }] },
  form: { marginHorizontal: 18, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  field: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  label: { width: 92, fontFamily: systemFont, fontSize: 14, lineHeight: 19, fontWeight: '400' },
  input: { flex: 1, paddingVertical: 15, fontFamily: systemFont, fontSize: 16, lineHeight: 21, fontWeight: '400', textAlign: 'right' },
  fieldError: { marginHorizontal: 16, paddingTop: 1, paddingBottom: 8, fontFamily: systemFont, fontSize: 11, lineHeight: 15 },
  bioCard: { minHeight: 142, marginHorizontal: 18, marginTop: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  cardLabel: { fontFamily: systemFont, fontSize: 13, lineHeight: 17, fontWeight: '500' },
  bioInput: { minHeight: 78, paddingTop: 8, paddingBottom: 20, paddingHorizontal: 0, fontFamily: systemFont, fontSize: 15, lineHeight: 21, fontWeight: '400' },
  counter: { position: 'absolute', right: 16, bottom: 12, fontFamily: systemFont, fontSize: 11, lineHeight: 15, fontWeight: '400' },
  locationCard: { minHeight: 68, marginHorizontal: 18, marginTop: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationContent: { flex: 1, paddingVertical: 10 },
  locationLabel: { fontFamily: systemFont, fontSize: 12, lineHeight: 15, fontWeight: '500' },
  locationInput: { minHeight: 28, paddingVertical: 2, paddingHorizontal: 0, fontFamily: systemFont, fontSize: 15, lineHeight: 20, fontWeight: '400' },
  cardError: { marginHorizontal: 34, marginTop: 6, fontFamily: systemFont, fontSize: 11, lineHeight: 15 },
  formError: { marginHorizontal: 24, marginTop: 14, fontFamily: systemFont, fontSize: 12, lineHeight: 16, textAlign: 'center' },
});
