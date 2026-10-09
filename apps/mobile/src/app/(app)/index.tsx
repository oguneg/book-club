import type { ClubSummary } from '@bookclub/shared';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useClubs } from '@/api/clubs';
import { authClient } from '@/auth/client';
import { formatAuthors } from '@/books/format';
import { clubErrorMessage } from '@/clubs/errors';
import { formatMeetingTime } from '@/clubs/format';
import { takePendingInvite } from '@/clubs/pendingInvite';
import { BookCover } from '@/components/BookCover';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

export default function Home() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const clubs = useClubs();

  // Back from signing in (or confirming an email) with an invite still open: continue joining.
  useEffect(() => {
    const code = takePendingInvite();
    if (code) router.push({ pathname: '/join/[code]', params: { code } });
  }, []);

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

      <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text, marginTop: space.xl }}>
        {t('home.yourClubs')}
      </Text>
      <View style={{ marginTop: space.md, gap: space.md }}>
        {clubs.isPending && <ActivityIndicator color={colors.accent} />}
        {clubs.isError && <Notice message={clubErrorMessage(t, clubs.error)} />}
        {clubs.data?.length === 0 && <Hint>{t('home.noClubs')}</Hint>}
        {clubs.data?.map((club) => <ClubCard key={club.id} club={club} />)}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xl }}>
        <Button label={t('home.createClub')} onPress={() => router.push('/clubs/new')} />
        <Button variant="secondary" label={t('home.joinClub')} onPress={() => router.push('/clubs/join')} />
      </View>

      <View style={{ marginTop: space.xl }}>
        <TextLink href="/books" label={t('home.findBook')} />
      </View>
    </Screen>
  );
}

function ClubCard({ club }: { club: ClubSummary }) {
  const { colors, fonts, fontSize, radius, space } = useTheme();
  const { t } = useTranslation();
  const [highlighted, setHighlighted] = useState(false);
  const details = [
    club.currentBook ? `${club.currentBook.title} · ${formatAuthors(club.currentBook.authors)}` : t('home.noBookYet'),
    [t('home.members', { count: club.memberCount }), club.nextMeeting ? t('home.nextMeeting', { when: formatMeetingTime(club.nextMeeting) }) : null]
      .filter(Boolean)
      .join(' · '),
  ];
  return (
    <Link href={{ pathname: '/clubs/[id]', params: { id: club.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={[club.name, ...details].join(', ')}
        onHoverIn={() => setHighlighted(true)}
        onHoverOut={() => setHighlighted(false)}
        onPressIn={() => setHighlighted(true)}
        onPressOut={() => setHighlighted(false)}
        style={{
          flexDirection: 'row',
          gap: space.lg,
          padding: space.lg,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: highlighted ? colors.accent : colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <BookCover cover={club.currentBook?.cover ?? null} title={club.currentBook?.title ?? club.name} size="md" />
        <View style={{ flex: 1, gap: space.xs, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>{club.name}</Text>
          {details.map((line) => (
            <Text key={line} style={{ fontSize: fontSize.sm, color: colors.textMuted }} numberOfLines={2}>
              {line}
            </Text>
          ))}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
