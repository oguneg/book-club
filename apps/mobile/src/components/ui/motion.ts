import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { nativeDriver, spring, useReducedMotion, useTheme } from '@/theme';

/** Pressing in is quick and exact in every style; letting go is where a style's feel shows. */
const PRESS_IN = { stiffness: 900, damping: 60, mass: 1 };

/**
 * A control that sinks a little under your finger and springs back as you let go (Playful bounces). Spread
 * the handlers on the Pressable and the style on an Animated.View around it. Still with reduced motion.
 */
export function usePressScale() {
  const { motion } = useTheme();
  const reduce = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  return {
    onPressIn: () => {
      if (!reduce) spring(scale, motion.press, PRESS_IN).start();
    },
    onPressOut: () => {
      spring(scale, 1, motion.pop).start();
    },
    style: { transform: [{ scale }] },
  };
}

/**
 * Something arriving once, when it mounts: it fades in and slides the style's distance (from the right for a
 * page, from below for a drawing). With reduced motion it only fades.
 */
export function useArrival(enabled: boolean, from: 'right' | 'below' = 'right') {
  const { motion } = useTheme();
  const reduce = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(enabled ? 0 : 1));
  useEffect(() => {
    if (!enabled) return;
    const animation = reduce
      ? Animated.timing(progress, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver })
      : spring(progress, 1, motion.arrive);
    animation.start();
    return () => animation.stop();
    // Once, on arrival: a later change of style or setting doesn't replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!enabled) return null;
  const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [motion.shift, 0] });
  return {
    opacity,
    transform: reduce ? [] : from === 'right' ? [{ translateX: offset }] : [{ translateY: offset }],
  };
}

/**
 * A small thing popping into place whenever `on` turns true, after `delay` ms: Playful's reading days and
 * its streak flame. Still with reduced motion.
 */
export function usePopIn(on: boolean, delay = 0) {
  const { motion } = useTheme();
  const reduce = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(on && !reduce ? 0 : 1));
  useEffect(() => {
    if (!on || reduce) {
      scale.setValue(1);
      return;
    }
    scale.setValue(0);
    const pop = Animated.sequence([Animated.delay(delay), spring(scale, 1, motion.pop)]);
    pop.start();
    return () => pop.stop();
  }, [on, reduce, delay, scale, motion.pop]);
  return scale;
}
