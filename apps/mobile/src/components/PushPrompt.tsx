import { BellRing } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { usePushState } from '@/notifications/usePushState';
import { Button } from '@/components/ui/Button';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

/**
 * "Get these on your phone": shown on phones until notifications are allowed, or after a no, how to turn
 * them on in Settings. Nothing on the web (it has the bell only) or once they're on.
 */
export function PushPrompt({ onDismiss }: { onDismiss?: () => void }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space } = useTheme();
  const { state, enable } = usePushState();
  if (state !== 'undetermined' && state !== 'denied') return null;
  return (
    <View style={{ gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <BellRing size={22} color={colors.accent} strokeWidth={1.75} aria-hidden />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: fontSize.md, color: colors.text }}>{t('notifications.push.title')}</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.45 }}>
            {state === 'denied' ? t('notifications.push.denied') : t('notifications.push.body')}
          </Text>
        </View>
      </View>
      <Button label={state === 'denied' ? t('notifications.push.openSettings') : t('notifications.push.turnOn')} onPress={() => void enable()} />
      {onDismiss && (
        <View style={{ alignItems: 'center' }}>
          <TextButton tone="muted" label={t('notifications.push.notNow')} onPress={onDismiss} />
        </View>
      )}
    </View>
  );
}
