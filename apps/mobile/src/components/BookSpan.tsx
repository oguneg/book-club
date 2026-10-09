import { POSITION_SCALE } from '@bookclub/shared';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';

/** The OS "reduce motion" setting (web: prefers-reduced-motion). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => live && setReduced(value));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

const RIBBON_W = 12;
const RIBBON_H = 26;
const LINE_Y = 22;

/**
 * The book as a line from its first page to its last, read part in bookcloth red, and a ribbon bookmark
 * at where you are. Meeting targets show as ticks, the club's pace as a dashed one. When you log a page
 * the ribbon slides to it (unless reduced motion is on).
 */
export function BookSpan({
  position,
  startPage,
  endPage,
  label,
  pace,
  marks = [],
}: {
  /** 0..10000 */
  position: number;
  startPage: number;
  endPage: number;
  /** For screen readers, e.g. "Page 142 of 320, 44%". */
  label: string;
  pace?: number | null;
  /** Positions along the book worth marking (e.g. "read to page 120" for a meeting). */
  marks?: number[];
}) {
  const { colors, fontSize, space } = useTheme();
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const p = Math.max(0, Math.min(1, position / POSITION_SCALE));
  const motion =
    Platform.OS === 'web' && !reduced
      ? ({ transitionProperty: 'transform', transitionDuration: '700ms', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' } as object)
      : null;
  const at = (q: number) => `${Math.max(0, Math.min(1, q / POSITION_SCALE)) * 100}%` as const;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      style={{ gap: space.xs }}
    >
      <View aria-hidden style={{ height: LINE_Y + 12 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {/* The whole book: a quiet line. */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: LINE_Y, height: 1, backgroundColor: colors.control }} />
        {/* What you've read: bookcloth red, grown from the first page. */}
        <View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: LINE_Y - 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.accent,
              transformOrigin: 'left',
              transform: [{ scaleX: p }],
            },
            motion,
          ]}
        />
        {marks.map((m) => (
          <View key={m} style={{ position: 'absolute', left: at(m), top: LINE_Y - 5, width: 1, height: 11, backgroundColor: colors.textMuted }} />
        ))}
        {pace !== null && pace !== undefined && (
          <View
            style={{ position: 'absolute', left: at(pace), top: LINE_Y - 7, height: 15, width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.text }}
          />
        )}
        {width > 0 && (
          <View style={[{ position: 'absolute', left: 0, top: LINE_Y - RIBBON_H + 6, transform: [{ translateX: p * width - RIBBON_W / 2 }] }, motion]}>
            <Svg width={RIBBON_W} height={RIBBON_H} viewBox={`0 0 ${RIBBON_W} ${RIBBON_H}`}>
              <Path d={`M0 0 H${RIBBON_W} V${RIBBON_H} L${RIBBON_W / 2} ${RIBBON_H - 6} L0 ${RIBBON_H} Z`} fill={colors.accent} />
            </Svg>
          </View>
        )}
      </View>
      <View aria-hidden style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontVariant: ['tabular-nums'] }}>{`p. ${startPage}`}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontVariant: ['tabular-nums'] }}>{`p. ${endPage}`}</Text>
      </View>
    </View>
  );
}
