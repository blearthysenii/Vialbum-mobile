import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors } from '@/theme/colors';

type AuthFieldProps = TextInputProps & { label: string };

export function AuthField({ label, ...inputProps }: AuthFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        {...inputProps}
        autoCorrect={false}
        placeholderTextColor="#A6A39A"
        selectionColor={colors.accent}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { borderBottomColor: colors.line, borderBottomWidth: 1, paddingVertical: 12 },
  label: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  input: { color: colors.ink, fontSize: 19, paddingHorizontal: 0, paddingTop: 8, paddingBottom: 4 },
});
