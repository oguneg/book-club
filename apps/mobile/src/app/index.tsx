import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { ServerStatus } from '@/components/ServerStatus';
import { useTheme } from '@/theme';

export default function Home() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space, radius } = theme;

  return (
    <Screen>
      <Text
        accessibilityRole="header"
        style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text }}
      >
        {t('appName')}
      </Text>
      <Text
        style={{
          fontFamily: fonts.readingItalic,
          fontSize: fontSize.lg,
          color: colors.textMuted,
          marginTop: space.sm,
        }}
      >
        {t('home.tagline')}
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: space.xl,
            marginTop: space.xxl,
            gap: space.sm,
          },
        ]}
      >
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
          {t('home.emptyTitle')}
        </Text>
        <Text style={{ fontSize: fontSize.md, lineHeight: fontSize.md * 1.5, color: colors.textMuted }}>
          {t('home.emptyBody')}
        </Text>
      </View>

      <View style={{ marginTop: space.xl }}>
        <ServerStatus />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
});
