import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

export function PasswordVisibilityToggle({
  color,
  isVisible,
  onToggle,
}: {
  color: string;
  isVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
      accessibilityRole="button"
      accessibilityState={{ expanded: isVisible }}
      hitSlop={8}
      onPress={onToggle}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    >
      <Ionicons
        name={isVisible ? 'eye-off-outline' : 'eye-outline'}
        size={19}
        color={color}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.42, transform: [{ scale: 0.9 }] },
});
