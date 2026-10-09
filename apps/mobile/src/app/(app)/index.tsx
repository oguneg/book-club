import type { ClubSummary, Reading } from '@bookclub/shared';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useClubs } from '@/api/clubs';
import { useReadings } from '@/api/readings';
import { authClient } from '@/auth/client';
import { formatAuthors } from '@/books/format';
import { clubErrorMessage } from '@/clubs/errors';
import { formatMeetingTime } from '@/clubs/format';
import { takePendingInvite } from '@/clubs/pendingInvite';
import { readingLine } from '@/readings/format';
import { BookCover } from '@/components/BookCover';
import { BookRow } from '@/components/BookRow';
import { BookSpan } from '@/components/BookSpan';
import { Columns } from '@/components/Columns';
import { LogProgress } from '@/components/LogProgress';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Desk } from '@/components/ui/Desk';
import { Notice } from '@/components/ui/Notice';
import { Hint, Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

/** Home is the book you're in: where you are, and one step to move your bookmark. Clubs sit beside it. */
export default function Home() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const readings = useReadings();
  const current = readings.data?.filter((r) => r.status === 'reading') ?? [];
  const [first, ...others] = current;
  const firstName = session?.user.name.trim().split(/\s+/)[0] ?? '';

  // Back from signing in (or confirming an email) with an invite still open: continue joining.
  useEffect(() => {
    const code = takePendingInvite();
    if (code) router.push({ pathname: '/join/[code]', params: { code } });
  }, []);

  return (
    <Screen width="wide">
      <PageTitle />
      <View style={styles.header}>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: fontSize.lg, color: colors.accent }}>{t('appName')}</Text>
        <TextLink href="/account" label={t('home.account')} />
      </View>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text, marginTop: space.xl, marginBottom: space.xl }}>
        {t('home.greeting', { name: firstName })}
      </Text>

      <Columns
        railLabel={t('home.yourClubs')}
        main={
          <View style={{ gap: space.xl }}>
            {readings.isPending && <ActivityIndicator color={colors.accent} />}
            {readings.isError && <Notice message={t('auth.errors.network')} />}
            {first ? <CurrentBook reading={first} /> : readings.isSuccess && <NothingOpen />}
            {others.length > 0 && (
              <Section title={t('home.alsoReading')}>
                {others.map((r) => (
                  <BookRow
                    key={r.id}
                    href={{ pathname: '/readings/[id]', params: { id: r.id } }}
                    cover={r.edition.cover}
                    title={r.edition.title}
                    lines={[formatAuthors(r.edition.authors), readingLine(t, r)]}
                  />
                ))}
              </Section>
            )}
            {first && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg }}>
                <TextLink href={{ pathname: '/books', params: { pick: 'read' } }} label={t('home.startAnother')} />
                <TextLink href="/shelf" label={t('home.shelf')} />
              </View>
            )}
          </View>
        }
        rail={<Clubs />}
      />
    </Screen>
  );
}

/** The book you're in, at the size it deserves: cover, where you are, and the log on the desk. */
function CurrentBook({ reading }: { reading: Reading }) {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const href = { pathname: '/readings/[id]', params: { id: reading.id } } as const;
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-end' }}>
        <Link href={href} aria-label={reading.edition.title}>
          <BookCover cover={reading.edition.cover} title={reading.edition.title} size="lg" />
        </Link>
        <View style={{ flex: 1, gap: space.xs, paddingBottom: space.xs }}>
          <Text accessibilityRole="header" aria-level={2}>
            <Link href={href} style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.2, color: colors.text }}>
              {reading.edition.title}
            </Link>
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>{formatAuthors(reading.edition.authors)}</Text>
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontVariant: ['tabular-nums'], marginTop: space.xs }}>{readingLine(t, reading)}</Text>
        </View>
      </View>
      <BookSpan position={reading.position} startPage={reading.startPage} endPage={reading.endPage} label={readingLine(t, reading)} />
      <Desk label={t('reading.log')}>
        <LogProgress reading={reading} />
      </Desk>
      <View style={{ alignSelf: 'flex-start' }}>
        <TextLink href={href} label={t('home.openReading')} />
      </View>
    </View>
  );
}

/** Nothing open: one clear way in. */
function NothingOpen() {
  const { t } = useTranslation();
  const { space } = useTheme();
  return (
    <Section title={t('home.readingNow')}>
      <Hint>{t('home.notReading')}</Hint>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' }}>
        <Button label={t('home.startBook')} onPress={() => router.push({ pathname: '/books', params: { pick: 'read' } })} />
        <TextLink href="/shelf" label={t('home.shelf')} />
      </View>
    </Section>
  );
}

function Clubs() {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const clubs = useClubs();
  return (
    <Section title={t('home.yourClubs')}>
      {clubs.isPending && <ActivityIndicator color={colors.accent} />}
      {clubs.isError && <Notice message={clubErrorMessage(t, clubs.error)} />}
      {clubs.data?.length === 0 && <Hint>{t('home.noClubs')}</Hint>}
      <View style={{ gap: space.xs }}>
        {clubs.data?.map((club) => (
          <ClubRow key={club.id} club={club} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' }}>
        <Button variant="secondary" label={t('home.createClub')} onPress={() => router.push('/clubs/new')} />
        <TextLink href="/clubs/join" label={t('home.joinClub')} />
      </View>
    </Section>
  );
}

function ClubRow({ club }: { club: ClubSummary }) {
  const { colors, fonts, fontSize, radius, space } = useTheme();
  const { t } = useTranslation();
  const [highlighted, setHighlighted] = useState(false);
  const details = [
    club.currentBook ? club.currentBook.title : t('home.noBookYet'),
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
        style={{ flexDirection: 'row', gap: space.md, padding: space.sm, marginHorizontal: -space.sm, borderRadius: radius.md, backgroundColor: highlighted ? colors.surface : 'transparent' }}
      >
        <BookCover cover={club.currentBook?.cover ?? null} title={club.currentBook?.title ?? club.name} size="sm" />
        <View style={{ flex: 1, gap: 2, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: fontSize.md, color: colors.text }}>{club.name}</Text>
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
