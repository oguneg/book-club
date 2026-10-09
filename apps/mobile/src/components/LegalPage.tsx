import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';
import { CONTACT_EMAIL, type LegalDocument } from '@/legal/content';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

/** Privacy policy, terms and help: a long read in the reading font, readable signed in or out. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const paragraph = { fontFamily: fonts.reading, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, color: colors.text };

  return (
    <Screen>
      <PageTitle title={doc.title} />
      <BackLink href="/" label={t('appName')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text }}>
        {doc.title}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: space.xs }}>{t('legal.updated', { date: doc.updated })}</Text>
      <Text style={[paragraph, { marginTop: space.lg }]}>
        <WithEmailLinks text={doc.intro} />
      </Text>
      {doc.sections.map((section) => (
        <View key={section.heading} style={{ marginTop: space.xl, gap: space.md }}>
          <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
            {section.heading}
          </Text>
          {section.paragraphs.map((p, i) => (
            <Text key={i} style={paragraph}>
              <WithEmailLinks text={p} />
            </Text>
          ))}
        </View>
      ))}
      <View style={{ marginTop: space.xxl }}>
        <LegalLinks />
      </View>
    </Screen>
  );
}

/** The contact address as a mail link wherever it appears in the text. */
function WithEmailLinks({ text }: { text: string }) {
  const { colors } = useTheme();
  const parts = text.split(CONTACT_EMAIL);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <Text accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)} style={{ color: colors.accent, textDecorationLine: 'underline' }}>
          {CONTACT_EMAIL}
        </Text>
      )}
    </Fragment>
  ));
}

/** Privacy · Terms · Help, at the foot of sign-in pages, the account page and the documents themselves. */
export function LegalLinks() {
  const { t } = useTranslation();
  const { space } = useTheme();
  return (
    <View role="navigation" aria-label={t('legal.linksLabel')} style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg }}>
      <TextLink href="/privacy" label={t('legal.privacy')} />
      <TextLink href="/terms" label={t('legal.terms')} />
      <TextLink href="/help" label={t('legal.help')} />
    </View>
  );
}
