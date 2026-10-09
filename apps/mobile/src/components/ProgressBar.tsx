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
  /** What screen readers announce, e.g. "Ann: page 120 of 320". Required: a bar without a name is just a shape. */
  label: string;
}) {
  const { colors } = useTheme();
  const pct = (p: number) => `${Math.max(0, Math.min(100, (p / POSITION_SCALE) * 100))}%` as const;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round((position / POSITION_SCALE) * 100) }}
      style={{ height: 10, justifyContent: 'center' }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.control }} />
      <View style={{ position: 'absolute', left: 0, height: 4, borderRadius: 2, width: pct(position), backgroundColor: emphasis ? colors.accent : colors.textMuted }} />
      {marker !== null && marker !== undefined && (
        <View
          aria-hidden
          style={{ position: 'absolute', left: pct(marker), top: -4, bottom: -4, width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.text }}
        />
      )}
    </View>
  );
}
