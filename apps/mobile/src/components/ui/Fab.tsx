import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@/theme';

/** The screen's main action, floating in thumb reach at the bottom right (e.g. "+ Note"); place it as a Screen `overlay`. */
export function Fab({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { colors, fontSize, space } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 52,
        paddingHorizontal: space.lg + 2,
        borderRadius: 26,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: colors.accent,
        boxShadow: '0px 2px 4px rgba(0,0,0,0.16), 0px 10px 24px -8px rgba(0,0,0,0.35)',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon size={20} color={colors.onAccent} strokeWidth={2} />
      <Text style={{ color: colors.onAccent, fontSize: fontSize.md, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
