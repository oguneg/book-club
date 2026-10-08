import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/theme';

export default function NotFound() {
  const { colors, fonts, fontSize, space, minTouch } = useTheme();
  const { t } = useTranslation();
  return (
    <Screen>
      <PageTitle title={t('notFound.title')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.xl, color: colors.text }}>
        {t('notFound.title')}
      </Text>
      <Link
        href="/"
        style={{
          color: colors.accent,
          fontSize: fontSize.md,
          fontWeight: '600',
          marginTop: space.lg,
          minHeight: minTouch,
          paddingVertical: space.md,
        }}
      >
        {t('notFound.back')}
      </Link>
    </Screen>
  );
}
