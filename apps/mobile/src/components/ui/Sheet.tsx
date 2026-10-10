import { X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { nativeDriver, spring, useReducedMotion, useTheme } from '@/theme';

/** Dragged this far down by its top (px), or flicked down faster than this (px/ms), a sheet closes. */
const CLOSE_DRAG = 96;
const CLOSE_FLICK = 0.9;
/** Let go short of closing: back into place, without a bounce. */
const SETTLE = { stiffness: 500, damping: 45, mass: 1 };
/** Paper below the sheet, so a bouncy arrival never shows a gap under it. */
const SKIRT = 80;

/**
 * A small task on top of the page: update your page, write a note, read the notes at a place. Rises from
 * the bottom on a phone (drag it down by its top to close), opens as a centred dialog on a wide screen.
 * Escape, the backdrop and the × all close it. It arrives with the style's spring and leaves quicker.
 */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, motion, radius, space, layout } = useTheme();
  const reduce = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= layout.wideFrom;

  // Stays on screen while it animates away.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const [shown] = useState(() => new Animated.Value(0));
  const [drag] = useState(() => new Animated.Value(0));
  const [sheetHeight, setSheetHeight] = useState(height);

  useEffect(() => {
    if (visible) {
      drag.setValue(0);
      const enter = reduce
        ? Animated.timing(shown, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver })
        : spring(shown, 1, motion.arrive);
      enter.start();
      return () => enter.stop();
    }
    const leave = Animated.timing(shown, { toValue: 0, duration: reduce ? 120 : motion.leave, easing: Easing.in(Easing.cubic), useNativeDriver: nativeDriver });
    leave.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return () => leave.stop();
  }, [visible, reduce, motion, shown, drag]);

  // Drag down by the grabber or title to close (phones). The × inside still takes its own taps.
  const gesture = useRef({ startY: 0, lastY: 0, lastT: 0, speed: 0 });
  const dragToClose: Partial<ViewProps> | null = wide
    ? null
    : {
        onStartShouldSetResponder: () => true,
        onResponderGrant: (e) => {
          const { pageY, timestamp } = e.nativeEvent;
          gesture.current = { startY: pageY, lastY: pageY, lastT: timestamp, speed: 0 };
        },
        onResponderMove: (e) => {
          const { pageY, timestamp } = e.nativeEvent;
          const g = gesture.current;
          if (timestamp > g.lastT) g.speed = (pageY - g.lastY) / (timestamp - g.lastT);
          g.lastY = pageY;
          g.lastT = timestamp;
          const dy = pageY - g.startY;
          drag.setValue(dy > 0 ? dy : dy / 5);
        },
        onResponderRelease: () => {
          const g = gesture.current;
          if (g.lastY - g.startY > CLOSE_DRAG || g.speed > CLOSE_FLICK) onClose();
          else spring(drag, 0, SETTLE).start();
        },
        onResponderTerminate: () => spring(drag, 0, SETTLE).start(),
      };

  const fade = shown.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const motionStyle = wide
    ? { opacity: fade, transform: reduce ? [] : [{ scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }
    : reduce
      ? { opacity: fade, transform: [{ translateY: drag }] }
      : { transform: [{ translateY: Animated.add(shown.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight + SKIRT, 0] }), drag) }] };

  return (
    // On the web the Modal itself is the dialog (role and aria-modal), so it carries the name.
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} aria-label={title}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop, opacity: fade }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          style={[
            {
              width: '100%',
              maxWidth: wide ? 480 : undefined,
              maxHeight: height * (wide ? 0.8 : 0.9),
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg + 4,
              borderTopRightRadius: radius.lg + 4,
              borderBottomLeftRadius: wide ? radius.lg + 4 : 0,
              borderBottomRightRadius: wide ? radius.lg + 4 : 0,
              paddingBottom: wide ? space.lg : Math.max(insets.bottom, space.lg),
              boxShadow: colors.deskShadow,
            },
            motionStyle,
          ]}
        >
          {!wide && <View aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: -SKIRT, height: SKIRT, backgroundColor: colors.surface }} />}
          <View {...dragToClose}>
            {!wide && <View aria-hidden style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: space.sm }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.lg, paddingRight: space.xs }}>
              <Text accessibilityRole="header" selectable={false} style={{ flex: 1, fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
                {title}
              </Text>
              <IconButton icon={X} label={t('common.close')} onPress={onClose} />
            </View>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.md }}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
