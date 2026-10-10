import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, type ColorValue } from 'react-native';
import { spring, useReducedMotion, useTheme } from '@/theme';

/**
 * A tab's icon. When its tab is chosen it grows into place: calmly in Classic, crisply in Sleek, and with a
 * bounce and a wobble in Playful. Still with reduced motion.
 */
export function TabIcon({ icon: Icon, focused, color, size }: { icon: LucideIcon; focused: boolean; color: ColorValue; size: number }) {
  const { motion, style } = useTheme();
  const reduce = useReducedMotion();
  const [pop] = useState(() => new Animated.Value(1));
  const was = useRef(focused);

  useEffect(() => {
    const chosen = focused && !was.current;
    was.current = focused;
    if (!chosen || reduce) return;
    pop.setValue(0);
    const grow = spring(pop, 1, motion.pop);
    grow.start();
    return () => grow.stop();
  }, [focused, reduce, pop, motion.pop]);

  const playful = style === 'playful';
  return (
    <Animated.View
      style={{
        transform: [
          { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [playful ? 0.7 : 0.86, 1] }) },
          { rotate: playful ? pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-14deg', '6deg', '0deg'] }) : '0deg' },
        ],
      }}
    >
      <Icon color={color} size={size} strokeWidth={focused && playful ? 2.25 : 1.75} />
    </Animated.View>
  );
}
