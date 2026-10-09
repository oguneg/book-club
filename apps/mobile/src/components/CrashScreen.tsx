import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { reportCrash } from '@/monitoring/crashes';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme';

/**
 * What a crash looks like: an apology and a way out, instead of a blank page. It renders outside the
 * app's providers (it replaces them), so it uses nothing that needs them, like safe areas or queries.
 */
export function CrashScreen({ error, retry }: { error: Error; retry: () => void }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  useEffect(() => reportCrash(error), [error]);

  return (
    <View role="main" style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
      <View style={{ maxWidth: 420, width: '100%', gap: space.lg }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, color: colors.text }}>
          {t('crash.title')}
        </Text>
        <Text style={{ fontSize: fontSize.md, lineHeight: fontSize.md * 1.5, color: colors.textMuted }}>{t('crash.body')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Button label={t('crash.retry')} onPress={retry} />
          <Button
            variant="secondary"
            label={t('crash.home')}
            onPress={() => {
              if (typeof window !== 'undefined' && window.location) window.location.assign('/');
              else retry();
            }}
          />
        </View>
      </View>
    </View>
  );
}
