import { Check } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nativeDriver, spring, useReducedMotion, useTheme } from '@/theme';

const ToastContext = createContext<(message: string) => void>(() => {});

/**
 * A short confirmation that rises from the bottom ("+26 pages", "Saved to Want to read") and fades away.
 * Playful's pops up with a bounce; with reduced motion it only fades.
 */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors, fontSize, motion, space, style } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [shown] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduce = useReducedMotion();
  const pops = style === 'playful' && !reduce;

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback(
    (text: string) => {
      clearTimeout(timer.current);
      setMessage(text);
      shown.setValue(0);
      (reduce
        ? Animated.timing(shown, { toValue: 1, duration: 160, useNativeDriver: nativeDriver })
        : spring(shown, 1, pops ? motion.pop : motion.arrive)
      ).start();
      timer.current = setTimeout(() => {
        Animated.timing(shown, { toValue: 0, duration: motion.leave, easing: Easing.in(Easing.cubic), useNativeDriver: nativeDriver }).start(({ finished }) => {
          if (finished) setMessage(null);
        });
      }, 2400);
    },
    [shown, reduce, pops, motion],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 88, alignItems: 'center' }}>
        {message && (
          <Animated.View
            accessibilityLiveRegion="polite"
            role="status"
            style={{
              opacity: shown.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: reduce
                ? []
                : [
                    { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [pops ? 24 : 16, 0] }) },
                    { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [pops ? 0.6 : 0.96, 1] }) },
                  ],
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              borderRadius: 999,
              backgroundColor: colors.text,
              boxShadow: '0px 2px 4px rgba(0,0,0,0.16), 0px 10px 24px -8px rgba(0,0,0,0.35)',
            }}
          >
            <Check size={18} color={colors.background} strokeWidth={2.5} />
            <Text style={{ color: colors.background, fontSize: fontSize.md, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{message}</Text>
          </Animated.View>
        )}
      </View>
    </ToastContext.Provider>
  );
}
