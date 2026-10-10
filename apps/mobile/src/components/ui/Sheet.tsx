import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/theme';

/**
 * A small task on top of the page: update your page, write a note, read the notes at a place. Slides up
 * from the bottom on a phone, opens as a centred dialog on a wide screen. Escape, the backdrop and the ×
 * all close it.
 */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space, layout } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= layout.wideFrom;

  return (
    // On the web the Modal itself is the dialog (role and aria-modal), so it carries the name.
    <Modal visible={visible} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose} aria-label={title}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.backdrop }}
        />
        <View
          style={{
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
          }}
        >
          {!wide && <View aria-hidden style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: space.sm }} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.lg, paddingRight: space.xs }}>
            <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
              {title}
            </Text>
            <IconButton icon={X} label={t('common.close')} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.xs, gap: space.md }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
