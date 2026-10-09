import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  /** Shown before the label, e.g. a provider logo. */
  icon?: ReactNode;
  accessibilityHint?: string;
}

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, icon, accessibilityHint }: ButtonProps) {
  const { colors, fontSize, radius, space, minTouch } = useTheme();
  const inactive = disabled || loading;
  const fill = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : undefined;
  const textColor = fill ? colors.onAccent : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: minTouch,
          borderRadius: radius.md,
          paddingHorizontal: space.lg,
          backgroundColor: fill ?? colors.surface,
          borderColor: fill ?? colors.control,
          opacity: inactive ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.row, { gap: space.sm }]}>
        {loading ? <ActivityIndicator color={textColor} /> : icon}
        <Text style={{ color: textColor, fontSize: fontSize.md, fontWeight: '600' }}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
