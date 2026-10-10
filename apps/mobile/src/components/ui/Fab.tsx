import type { LucideIcon } from 'lucide-react-native';
import { Animated, Pressable, Text } from 'react-native';
import { usePressScale } from '@/components/ui/motion';
import { useTheme } from '@/theme';

/** The screen's main action, floating in thumb reach at the bottom right (e.g. "+ Note"); place it as a Screen `overlay`. */
export function Fab({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { colors, fontSize, space } = useTheme();
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed }) => ({
          height: 52,
          paddingHorizontal: space.lg + 2,
          borderRadius: 26,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          backgroundColor: colors.accent,
          boxShadow: '0px 2px 4px rgba(0,0,0,0.16), 0px 10px 24px -8px rgba(0,0,0,0.35)',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Icon size={20} color={colors.onAccent} strokeWidth={2} />
        <Text style={{ color: colors.onAccent, fontSize: fontSize.md, fontWeight: '700' }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}
