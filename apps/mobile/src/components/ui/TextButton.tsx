import { Pressable, Text } from 'react-native';
import { useTheme } from '@/theme';

/** A small action that reads as text: "Reply", "Edit", "Unblock". The hit area still reaches 48 pt. */
export function TextButton({
  label,
  onPress,
  tone = 'accent',
  accessibilityLabel,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'muted' | 'danger';
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const { colors, fontSize } = useTheme();
  const color = tone === 'danger' ? colors.danger : tone === 'muted' ? colors.textMuted : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ minHeight: 32, justifyContent: 'center', opacity: disabled ? 0.5 : pressed ? 0.6 : 1 })}
    >
      <Text style={{ color, fontSize: fontSize.sm, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
