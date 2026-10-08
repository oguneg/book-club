import { Text, View } from 'react-native';
import { useTheme } from '@/theme';

/** A message above or below a form: an error, or a confirmation that something happened. */
export function Notice({ message, tone = 'error' }: { message: string; tone?: 'error' | 'info' }) {
  const { colors, fontSize, radius, space } = useTheme();
  const color = tone === 'error' ? colors.danger : colors.success;
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={{ borderLeftWidth: 3, borderLeftColor: color, backgroundColor: colors.surface, borderRadius: radius.sm, padding: space.md }}
    >
      <Text style={{ color: colors.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 }}>{message}</Text>
    </View>
  );
}
