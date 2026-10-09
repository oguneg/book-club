import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme';

/** An icon you can press, with a name for screen readers (and, optionally, a visible label beside it). */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  showLabel = false,
  tone = 'ink',
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  showLabel?: boolean;
  tone?: 'ink' | 'accent' | 'muted' | 'danger';
  disabled?: boolean;
}) {
  const { colors, fontSize, minTouch } = useTheme();
  const color = tone === 'accent' ? colors.accent : tone === 'muted' ? colors.textMuted : tone === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: minTouch - 4,
        minHeight: minTouch - 4,
        paddingHorizontal: showLabel ? 10 : 0,
        borderRadius: (minTouch - 4) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon size={20} color={color} strokeWidth={1.75} />
        {showLabel && <Text style={{ color, fontSize: fontSize.sm, fontWeight: '600' }}>{label}</Text>}
      </View>
    </Pressable>
  );
}
