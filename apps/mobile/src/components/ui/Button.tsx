import type { ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePressScale } from '@/components/ui/motion';
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
  /** When several buttons share a label ("Update page" per book); must start with the visible label. */
  accessibilityLabel?: string;
}

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, icon, accessibilityHint, accessibilityLabel }: ButtonProps) {
  const { colors, fontSize, radius, space, minTouch } = useTheme();
  const inactive = disabled || loading;
  // Disabled (not busy) buttons go neutral: a faded red still looks like a red button.
  const filled = variant === 'primary' || variant === 'danger';
  const fill = filled && disabled && !loading ? colors.border : variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : undefined;
  const textColor = filled && disabled && !loading ? colors.textMuted : fill ? colors.onAccent : colors.text;
  const press = usePressScale();

  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        aria-disabled={inactive}
        aria-busy={loading}
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        disabled={inactive}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed }) => [
          styles.base,
          {
            minHeight: minTouch,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            backgroundColor: fill ?? colors.surface,
            borderColor: fill ?? colors.control,
            opacity: loading ? 0.75 : disabled && !filled ? 0.55 : pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={[styles.row, { gap: space.sm }]}>
          {loading ? <ActivityIndicator color={textColor} /> : icon}
          <Text style={{ color: textColor, fontSize: fontSize.md, fontWeight: '600' }}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
