import { resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MomentGrid } from '@/features/moments/MomentGrid';
import { useProfileTheme } from '@/features/profile/theme';
export default function SavedMomentsScreen() { const theme = useProfileTheme(); return <SafeAreaView style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}><MomentGrid filter={{ saved: true }} header={<View style={{ padding: 24, gap: 22 }}><Pressable onPress={() => router.back()}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>‹ Back</Text></Pressable><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 28, fontWeight: '600' })}>Saved Moments</Text></View>} /></SafeAreaView>; }
