import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { useTheme } from '@/theme';

/** How far through a book, as a slim bar that glides forward when you log (still, with reduced motion). Decorative: the text beside it says the same. */
export function ProgressBar({ value, height = 4, track }: { value: number; height?: number; track?: string }) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  const [width] = useState(() => new Animated.Value(clamped));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);
  useEffect(() => {
    Animated.timing(width, { toValue: clamped, duration: reduceMotion ? 0 : 700, easing: Easing.out(Easing.exp), useNativeDriver: false }).start();
  }, [clamped, reduceMotion, width]);

  return (
    <View aria-hidden style={{ height, borderRadius: height / 2, backgroundColor: track ?? colors.border, overflow: 'hidden' }}>
      <Animated.View
        style={{ height: '100%', borderRadius: height / 2, backgroundColor: colors.accent, width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
      />
    </View>
  );
}
