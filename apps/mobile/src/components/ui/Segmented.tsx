import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { spring, useReducedMotion, useTheme } from '@/theme';

/** Between the row's edge and the choices, and between choices. */
const PAD = 3;
const LIFT = '0px 1px 2px rgba(0,0,0,0.12)';

/**
 * Two to four choices side by side, one selected: the club page's tabs, or who a note is for. The raised
 * pill slides to the choice you tap (straight there with reduced motion).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  kind = 'tab',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  kind?: 'tab' | 'radio';
}) {
  const { colors, fontSize, motion, radius, minTouch } = useTheme();
  const reduce = useReducedMotion();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  // The row's width inside its border and padding, once it's laid out; the choices share it equally.
  const [inner, setInner] = useState(0);
  const segment = inner > 0 ? (inner - PAD * (options.length - 1)) / options.length : 0;
  const target = index * (segment + PAD);
  const [x] = useState(() => new Animated.Value(0));
  const placed = useRef(false);

  useEffect(() => {
    if (segment === 0) return;
    // The first time (and with reduced motion) the pill is simply there.
    if (!placed.current || reduce) {
      placed.current = true;
      x.setValue(target);
      return;
    }
    const slide = spring(x, target, motion.arrive);
    slide.start();
    return () => slide.stop();
  }, [target, segment, reduce, x, motion.arrive]);

  const sliding = segment > 0;
  return (
    <View
      accessibilityRole={kind === 'tab' ? 'tablist' : 'radiogroup'}
      accessibilityLabel={label}
      onLayout={(e) => setInner(e.nativeEvent.layout.width - 2 - PAD * 2)}
      style={{ flexDirection: 'row', padding: PAD, gap: PAD, borderRadius: radius.md + 2, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}
    >
      {sliding && (
        <Animated.View
          aria-hidden
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: PAD,
            bottom: PAD,
            left: PAD,
            width: segment,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.control,
            boxShadow: LIFT,
            transform: [{ translateX: x }],
          }}
        />
      )}
      {options.map((o) => {
        const selected = o.value === value;
        // Until the row is measured, the selected choice draws its own pill.
        const own = selected && !sliding;
        return (
          <Pressable
            key={o.value}
            accessibilityRole={kind}
            aria-selected={kind === 'tab' ? selected : undefined}
            aria-checked={kind === 'radio' ? selected : undefined}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: minTouch - 8,
              paddingHorizontal: 8,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: own ? colors.surface : 'transparent',
              borderWidth: 1,
              borderColor: own ? colors.control : 'transparent',
              boxShadow: own ? LIFT : undefined,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text numberOfLines={1} style={{ color: selected ? colors.text : colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
