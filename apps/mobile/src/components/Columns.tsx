import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useTheme } from '@/theme';

/**
 * A page's main column and its side rail. On screens 1024px and wider they sit side by side; narrower,
 * the rail follows the main column. Use with `<Screen width="wide">`.
 */
export function Columns({ main, rail, railLabel }: { main: ReactNode; rail: ReactNode; railLabel?: string }) {
  const { width } = useWindowDimensions();
  const { layout, space } = useTheme();
  if (width < layout.wideFrom) {
    return (
      <View style={{ gap: space.xl }}>
        {main}
        {rail}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: space.xxl, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0, gap: space.xl }}>{main}</View>
      <View role="complementary" aria-label={railLabel} style={{ width: layout.rail, gap: space.xl }}>
        {rail}
      </View>
    </View>
  );
}

/** Whether the page is laid out with a side rail (for small adjustments, e.g. cover sizes). */
export function useWide(): boolean {
  const { width } = useWindowDimensions();
  const { layout } = useTheme();
  return width >= layout.wideFrom;
}
