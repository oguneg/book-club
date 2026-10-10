import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { nativeDriver, useReducedMotion, useTheme } from '@/theme';

const PIECES = 24;
/** Spread evenly round the circle (the golden angle), at a few distances, sizes and spins. */
const pieces = Array.from({ length: PIECES }, (_, i) => {
  const angle = ((i * 137.5) % 360) * (Math.PI / 180);
  const distance = 64 + ((i * 37) % 60);
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance * 0.8,
    spin: (i % 2 ? 1 : -1) * (200 + ((i * 53) % 220)),
    shape: i % 3, // a dot, a strip, a square
  };
});
/** Bursting out fast, then drifting down as it fades. */
const STEPS = [0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.85, 1];
const burst = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A burst of confetti from the middle of its box, once, at the end of a book: Playful only, and none with
 * reduced motion. Place it over the thing it celebrates. Decorative.
 */
export function Confetti() {
  const { art, colors } = useTheme();
  const reduce = useReducedMotion();
  const [t] = useState(() => new Animated.Value(0));
  const on = art !== null && !reduce;

  useEffect(() => {
    if (!on) return;
    const run = Animated.sequence([Animated.delay(280), Animated.timing(t, { toValue: 1, duration: 1300, easing: Easing.linear, useNativeDriver: nativeDriver })]);
    run.start();
    return () => run.stop();
  }, [on, t]);

  if (!on || !art) return null;
  const palette = [colors.accent, art.sun, art.mint, art.lilac];
  return (
    <View aria-hidden pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: p.shape === 1 ? 4 : 8,
            height: p.shape === 1 ? 12 : 8,
            borderRadius: p.shape === 0 ? 4 : 1.5,
            backgroundColor: palette[i % palette.length],
            opacity: t.interpolate({ inputRange: [0, 0.02, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: STEPS, outputRange: STEPS.map((s) => p.dx * burst(s)) }) },
              { translateY: t.interpolate({ inputRange: STEPS, outputRange: STEPS.map((s) => p.dy * burst(s) + 70 * s * s) }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              { scale: t.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0.3, 1, 0.7] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
