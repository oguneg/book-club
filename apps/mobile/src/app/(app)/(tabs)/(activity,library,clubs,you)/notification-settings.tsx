import { NOTIFICATION_TOPICS } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useChangeNotificationSettings, useNotificationSettings } from '@/api/notifications';
import { usePushState } from '@/notifications/usePushState';
import { PageTitle } from '@/components/PageTitle';
import { PushPrompt } from '@/components/PushPrompt';
import { Screen } from '@/components/Screen';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { Toggle } from '@/components/ui/Toggle';
import { useTheme } from '@/theme';

/** What you hear about: four switches that follow you to every device, and whether this phone shows them. */
export default function NotificationSettingsPage() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const settings = useNotificationSettings();
  const change = useChangeNotificationSettings();
  const push = usePushState();
  const [error, setError] = useState(false);

  return (
    <Screen>
      <PageTitle title={t('notifications.settings')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text, marginBottom: space.lg }}>
        {t('notifications.settings')}
      </Text>
      <View style={{ gap: space.xl }}>
        <PushPrompt />
        {push.state === 'granted' && <Hint>{t('notifications.push.on')}</Hint>}
        {error && <Notice message={t('notifications.saveFailed')} />}
        {settings.isPending && <ActivityIndicator color={colors.accent} />}
        {settings.data && (
          <View style={{ gap: space.sm }}>
            {NOTIFICATION_TOPICS.map((topic) => (
              <Toggle
                key={topic}
                label={t(`notifications.topics.${topic}.name`)}
                detail={t(`notifications.topics.${topic}.body`)}
                value={settings.data[topic]}
                onChange={(on) => {
                  setError(false);
                  change({ [topic]: on }).catch(() => setError(true));
                }}
              />
            ))}
            <Hint>{t('notifications.followsYou')}</Hint>
          </View>
        )}
      </View>
    </Screen>
  );
}
