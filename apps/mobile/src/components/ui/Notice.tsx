import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/theme';

/**
 * A message above or below a form: an error, or a confirmation that something happened. A drawn mark says
 * which, so the tone never rests on colour alone.
 */
export function Notice({ message, tone = 'error' }: { message: string; tone?: 'error' | 'info' }) {
  const { colors, fontSize, radius, space } = useTheme();
  const color = tone === 'error' ? colors.danger : colors.success;
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: color,
        backgroundColor: colors.surface,
        borderRadius: radius.sm,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
      }}
    >
      <Svg width={16} height={16} viewBox="0 0 16 16" aria-hidden style={{ marginTop: 2 }}>
        <Circle cx={8} cy={8} r={7} stroke={color} strokeWidth={1.5} fill="none" />
        {tone === 'error' ? (
          <Path d="M8 4.5v4.25M8 11.25v.25" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
        ) : (
          <Path d="m5 8.25 2 2 4-4.5" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        )}
      </Svg>
      <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 }}>{message}</Text>
    </View>
  );
}
