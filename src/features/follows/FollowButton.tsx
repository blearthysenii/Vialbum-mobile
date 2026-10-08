import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useProfileTheme } from '@/features/profile/theme';
import { useFollows } from './useFollows';
export function FollowButton({ id, initial, compact = false }: { id: string; initial: boolean; compact?: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { entries, toggle, userId } = useFollows();
  const theme = useProfileTheme();
  const entry = entries.get(id);
  const following = entry?.following ?? initial;
  if (userId === id) return null;
  return <View style={styles.wrap}>
    <Pressable accessibilityRole="button" accessibilityState={{ selected: following, busy: entry?.pending ?? false, disabled: entry?.pending ?? false }} disabled={entry?.pending} onPress={(event) => { event.stopPropagation(); void toggle(id, initial); }} style={({ pressed }) => [styles.button, compact && styles.compact, { backgroundColor: resolvePresentationColor(following ? theme.glassStrong : theme.accent, 'backgroundColor', 'control'), borderColor: resolvePresentationColor(theme.border, 'borderColor', 'control') }, pressed && styles.pressed]}>
      <Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(following ? theme.ink : '#FFFFFF', 'color', 'content') }])}>{following ? 'Following' : 'Follow'}</Text>
    </Pressable>
    {entry?.error ? <Text accessibilityRole="alert" style={presentationTextStyle([styles.error, { color: resolvePresentationColor(theme.danger, 'color', 'content') }])}>{entry.error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ wrap: { alignItems: 'center' }, button: { minHeight: 48, minWidth: 160, paddingHorizontal: 28, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' }, compact: { minWidth: 92, minHeight: 36, paddingHorizontal: 14, borderRadius: 18 }, label: { fontSize: 15, fontWeight: '600' }, pressed: { transform: [{ scale: 0.97 }], opacity: 0.75 }, error: { fontSize: 11, maxWidth: 180, textAlign: 'center', marginTop: 6 } });
const presentationBaselineStyles = styles;
