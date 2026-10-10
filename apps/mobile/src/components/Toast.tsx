import { Check } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

const ToastContext = createContext<(message: string) => void>(() => {});

/** A short confirmation that rises from the bottom ("+26 pages", "Saved to Want to read") and fades away. */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors, fontSize, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [shown] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const show = useCallback(
    (text: string) => {
      clearTimeout(timer.current);
      setMessage(text);
      shown.setValue(reduceMotion ? 1 : 0);
      Animated.timing(shown, { toValue: 1, duration: reduceMotion ? 0 : 260, easing: Easing.out(Easing.exp), useNativeDriver: false }).start();
      timer.current = setTimeout(() => {
        Animated.timing(shown, { toValue: 0, duration: reduceMotion ? 0 : 200, useNativeDriver: false }).start(() => setMessage(null));
      }, 2400);
    },
    [shown, reduceMotion],
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
              opacity: shown,
              transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
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
