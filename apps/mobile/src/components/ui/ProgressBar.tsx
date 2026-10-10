import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { useReducedMotion, useTheme } from '@/theme';

/**
 * How far through a book, as a slim bar that glides forward when you log (Playful's overshoots a touch and
 * settles; still, with reduced motion). Decorative: the text beside it says the same.
 */
export function ProgressBar({ value, height = 4, track }: { value: number; height?: number; track?: string }) {
  const { colors, motion } = useTheme();
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));
  const [width] = useState(() => new Animated.Value(clamped));

  useEffect(() => {
    if (reduce) {
      width.setValue(clamped);
      return;
    }
    // Width can't use the native driver.
    const glide = Animated.spring(width, { toValue: clamped, ...motion.glide, useNativeDriver: false });
    glide.start();
    return () => glide.stop();
  }, [clamped, reduce, width, motion.glide]);

  return (
    <View aria-hidden style={{ height, borderRadius: height / 2, backgroundColor: track ?? colors.border, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: colors.accent,
          width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}
