import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { authClient } from '@/auth/client';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { ServerStatus } from '@/components/ServerStatus';
import { Button } from '@/components/ui/Button';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

export default function Home() {
  const { colors, fonts, fontSize, space, radius } = useTheme();
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Screen>
      <PageTitle />
      <View style={styles.header}>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: fontSize.lg, color: colors.accent }}>{t('appName')}</Text>
        <TextLink href="/account" label={t('home.account')} />
      </View>
      <Text
        accessibilityRole="header"
        style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text, marginTop: space.xl }}
      >
        {t('home.greeting', { name: session?.user.name ?? '' })}
      </Text>
      <Text style={{ fontFamily: fonts.readingItalic, fontSize: fontSize.lg, color: colors.textMuted, marginTop: space.sm }}>
        {t('tagline')}
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: space.xl, marginTop: space.xxl, gap: space.sm },
        ]}
      >
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
          {t('home.emptyTitle')}
        </Text>
        <Text style={{ fontSize: fontSize.md, lineHeight: fontSize.md * 1.5, color: colors.textMuted }}>{t('home.emptyBody')}</Text>
      </View>

      <View style={{ marginTop: space.xl, alignSelf: 'flex-start' }}>
        <Button
          label={t('home.signOut')}
          variant="secondary"
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            await authClient.signOut();
            setSigningOut(false);
          }}
        />
      </View>

      <View style={{ marginTop: space.xxl }}>
        <ServerStatus />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
