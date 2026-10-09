import { POSITION_SCALE } from '@bookclub/shared';
import { View } from 'react-native';
import { useTheme } from '@/theme';

/**
 * A thin bar for a position (0..10000), with an optional dashed marker (e.g. today's pace).
 * The label is for screen readers; the visible text sits next to the bar.
 */
export function ProgressBar({
  position,
  marker,
  emphasis = true,
  label,
}: {
  position: number;
  marker?: number | null;
  emphasis?: boolean;
  label?: string;
}) {
  const { colors } = useTheme();
  const pct = (p: number) => `${Math.max(0, Math.min(100, (p / POSITION_SCALE) * 100))}%` as const;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round((position / POSITION_SCALE) * 100) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, justifyContent: 'center' }}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(position), borderRadius: 4, backgroundColor: emphasis ? colors.accent : colors.textMuted }} />
      {marker !== null && marker !== undefined && (
        <View
          aria-hidden
          style={{ position: 'absolute', left: pct(marker), top: -4, bottom: -4, width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.text }}
        />
      )}
    </View>
  );
}
