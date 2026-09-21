import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useProfileTheme } from '@/features/profile/theme';
import type { Journey } from '../types';

export function JourneyVisibilityField({ value, onChange }: { value: Journey['visibility']; onChange: (value: Journey['visibility']) => void }) {
  const theme = useProfileTheme();
  return <View style={[styles.section, { backgroundColor: theme.glassStrong }]}>
    <Text style={[styles.label, { color: theme.muted }]}>VISIBILITY</Text>
    <View style={[styles.choices, { backgroundColor: theme.placeholder }]}>
      {(['private', 'public'] as const).map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: value === option }} onPress={() => onChange(option)} style={[styles.choice, value === option && { backgroundColor: theme.canvas }]}>
        <Ionicons name={option === 'private' ? 'lock-closed-outline' : 'globe-outline'} size={16} color={theme.ink} />
        <Text style={[styles.choiceLabel, { color: theme.ink }]}>{option === 'private' ? 'Private' : 'Public'}</Text>
      </Pressable>)}
    </View>
    <Text style={[styles.help, { color: theme.muted }]}>{value === 'private' ? 'Only you can see this journey.' : 'Others can discover this journey on Vialbum.'}</Text>
  </View>;
}
const styles = StyleSheet.create({
  section: { padding: 16, borderRadius: 24 }, label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 12 },
  choices: { flexDirection: 'row', padding: 3, borderRadius: 12, gap: 3 }, choice: { flex: 1, minHeight: 40, borderRadius: 9, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  choiceLabel: { fontSize: 14, fontWeight: '600' }, help: { fontSize: 12, lineHeight: 18, marginTop: 10 },
});
