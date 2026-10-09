import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { authClient } from '@/auth/client';
import { LegalLinks } from '@/components/LegalPage';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackButton } from '@/components/ui/BackButton';
import { useTheme } from '@/theme';

/**
 * Frame for single-form pages (sign-in, recovery, adding a book): the brand (signed out) or a way back
 * (signed in), page title, optional subtitle, then the form.
 */
export function FormLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  // Signed-out visitors (sign-in, sign-up, invites) see where the privacy policy and terms are.
  const { data: session, isPending } = authClient.useSession();
  return (
    <Screen width="narrow">
      <PageTitle title={title} />
      {session ? (
        <BackButton label={t('common.back')} fallback="/" />
      ) : (
        <Text style={{ fontFamily: fonts.headingBold, fontSize: fontSize.lg, color: colors.accent }}>{t('appName')}</Text>
      )}
      <Text
        accessibilityRole="header"
        style={{ fontFamily: fonts.heading, fontSize: fontSize.xl, color: colors.text, marginTop: space.xl }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text style={{ fontSize: fontSize.md, lineHeight: fontSize.md * 1.5, color: colors.textMuted, marginTop: space.sm }}>
          {subtitle}
        </Text>
      )}
      <View style={{ marginTop: space.xl, gap: space.lg }}>{children}</View>
      {!isPending && !session && (
        <View style={{ marginTop: space.xxl }}>
          <LegalLinks />
        </View>
      )}
    </Screen>
  );
}

/** "or" between Google and the email form. */
export function OrDivider() {
  const { colors, fontSize, space } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} aria-hidden>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{t('common.or')}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
