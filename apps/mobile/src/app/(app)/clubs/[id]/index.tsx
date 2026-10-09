import { bookKeyOf, formatInviteCode, roleAtLeast, type ClubBook, type ClubDetail } from '@bookclub/shared';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useClub, useClubActions } from '@/api/clubs';
import { useClubProgress } from '@/api/readings';
import { authClient } from '@/auth/client';
import { appUrl } from '@/auth/client';
import { formatAuthors, publishedYear } from '@/books/format';
import { clubErrorMessage } from '@/clubs/errors';
import { formatDate, formatMeetingTime } from '@/clubs/format';
import { readingLine } from '@/readings/format';
import { BookCover } from '@/components/BookCover';
import { BookRow } from '@/components/BookRow';
import { ClubProgress } from '@/components/ClubProgress';
import { Notes } from '@/components/Notes';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Notice } from '@/components/ui/Notice';
import { Hint, Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

export default function ClubPage() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useClub(id);
  const club = query.data;

  return (
    <Screen>
      <PageTitle title={club?.name} />
      <BackLink href="/" label={t('appName')} />
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={clubErrorMessage(t, query.error)} />}
      {club && (
        <>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text }}>
            {club.name}
          </Text>
          {club.description && (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5, marginTop: space.sm }}>{club.description}</Text>
          )}
          <View style={{ gap: space.lg, marginTop: space.xl }}>
            <CurrentBook club={club} />
            {club.currentBook && <Progress club={club} book={club.currentBook} />}
            {club.currentBook && <ClubNotes club={club} book={club.currentBook} />}
            {club.currentBook && <Meetings club={club} book={club.currentBook} />}
            <InviteSection club={club} />
            <Members club={club} />
            {club.pastBooks.length > 0 && (
              <Section title={t('clubs.club.pastBooks')}>
                {club.pastBooks.map((b) => (
                  <BookRow
                    key={b.id}
                    href={{ pathname: '/books/edition/[id]', params: { id: b.edition.id } }}
                    cover={b.edition.cover}
                    title={b.edition.title}
                    lines={[formatAuthors(b.edition.authors), b.finishedAt ? t('clubs.club.finishedOn', { date: formatDate(b.finishedAt.slice(0, 10)) }) : null]}
                  />
                ))}
              </Section>
            )}
            <TextLink href={{ pathname: '/clubs/[id]/settings', params: { id: club.id } }} label={t('clubs.club.settings')} />
          </View>
        </>
      )}
    </Screen>
  );
}

function CurrentBook({ club }: { club: ClubDetail }) {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const actions = useClubActions(club.id);
  const [error, setError] = useState<string>();
  const isAdmin = roleAtLeast(club.myRole, 'admin');
  const book = club.currentBook;
  const pick = () => router.push({ pathname: '/books', params: { pick: `club:${club.id}` } });

  if (!book) {
    return (
      <Section title={t('clubs.club.currentBook')}>
        <Hint>{t('clubs.club.noBook')}</Hint>
        {isAdmin && (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button label={t('clubs.club.chooseBook')} onPress={pick} />
          </View>
        )}
      </Section>
    );
  }

  const e = book.edition;
  return (
    <Section title={t('clubs.club.currentBook')}>
      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <BookCover cover={e.cover} title={e.title} size="md" />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>{e.title}</Text>
          <Hint>{formatAuthors(e.authors)}</Hint>
          <Hint>{[e.publisher, publishedYear(e.published), e.pageCount ? t('books.pages', { count: e.pageCount }) : null].filter(Boolean).join(' · ')}</Hint>
          <Hint>
            {[t('clubs.club.started', { date: formatDate(book.startDate) }), book.finishDate ? t('clubs.club.finishBy', { date: formatDate(book.finishDate) }) : null]
              .filter(Boolean)
              .join(' · ')}
          </Hint>
        </View>
      </View>
      {error && <Notice message={error} />}
      {isAdmin && (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Button variant="secondary" label={t('clubs.club.changeDates')} onPress={() => router.push({ pathname: '/clubs/[id]/book', params: { id: club.id } })} />
            <Button variant="secondary" label={t('clubs.club.changeBook')} onPress={pick} />
          </View>
          <ConfirmButton
            label={t('clubs.club.finish')}
            question={t('clubs.club.finishQuestion')}
            confirmLabel={t('clubs.club.finishConfirm')}
            onConfirm={() => actions.finishBook().catch((err) => setError(clubErrorMessage(t, err)))}
          />
        </View>
      )}
    </Section>
  );
}

function Meetings({ club, book }: { club: ClubDetail; book: ClubBook }) {
  const { colors, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const isAdmin = roleAtLeast(club.myRole, 'admin');
  // Captured once per visit: which meetings count as past only matters at page-load granularity.
  const [now] = useState(() => Date.now());

  return (
    <Section title={t('clubs.club.meetings')}>
      {book.meetings.length === 0 && <Hint>{t('clubs.club.noMeetings')}</Hint>}
      {book.meetings.map((m) => {
        const past = new Date(m.startsAt).getTime() < now;
        const lines = [m.location, m.readToPage ? t('clubs.club.readTo', { page: m.readToPage }) : null].filter(Boolean).join(' · ');
        const content = (
          <View style={{ gap: 2, opacity: past ? 0.6 : 1 }}>
            <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>
              {formatMeetingTime(m.startsAt)}
              {past ? ` · ${t('clubs.club.past')}` : ''}
            </Text>
            <Text style={{ color: colors.text, fontSize: fontSize.md }}>{m.title}</Text>
            {lines ? <Hint>{lines}</Hint> : null}
          </View>
        );
        return isAdmin ? (
          <View key={m.id} style={{ gap: space.xs }}>
            {content}
            <TextLink href={{ pathname: '/clubs/[id]/meeting', params: { id: club.id, meetingId: m.id } }} label={t('clubs.meeting.editTitle')} />
          </View>
        ) : (
          <View key={m.id}>{content}</View>
        );
      })}
      {isAdmin && (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button variant="secondary" label={t('clubs.club.planMeeting')} onPress={() => router.push({ pathname: '/clubs/[id]/meeting', params: { id: club.id } })} />
        </View>
      )}
    </Section>
  );
}

function InviteSection({ club }: { club: ClubDetail }) {
  const { colors, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const actions = useClubActions(club.id);
  const [copied, setCopied] = useState(false);
  const link = appUrl(`/join/${formatInviteCode(club.inviteCode)}`);

  return (
    <Section title={t('clubs.club.invite')}>
      <Hint>{t('clubs.club.inviteBody', { count: club.members.length, cap: club.memberCap })}</Hint>
      <Text selectable style={{ color: colors.text, fontSize: fontSize.md }}>
        {link}
      </Text>
      <Hint>{t('clubs.club.code', { code: formatInviteCode(club.inviteCode) })}</Hint>
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          label={copied ? t('clubs.club.copied') : t('clubs.club.copyLink')}
          onPress={async () => {
            await Clipboard.setStringAsync(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        />
      </View>
      {roleAtLeast(club.myRole, 'admin') && (
        <View style={{ marginTop: space.xs }}>
          <ConfirmButton
            label={t('clubs.club.newLink')}
            question={t('clubs.club.newLinkQuestion')}
            confirmLabel={t('clubs.club.newLinkConfirm')}
            onConfirm={() => actions.rotateInvite()}
          />
        </View>
      )}
    </Section>
  );
}

function Members({ club }: { club: ClubDetail }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const isAdmin = roleAtLeast(club.myRole, 'admin');
  return (
    <Section title={t('clubs.club.members')}>
      {club.members.map((m) => {
        const label = `${m.name}${m.role !== 'member' ? ` · ${t(`clubs.roles.${m.role}`)}` : ''}`;
        return isAdmin ? (
          <TextLink key={m.userId} href={{ pathname: '/clubs/[id]/member/[userId]', params: { id: club.id, userId: m.userId } }} label={label} />
        ) : (
          <Text key={m.userId} style={{ color: colors.text, fontSize: fontSize.md, paddingVertical: space.xs }}>
            {label}
          </Text>
        );
      })}
    </Section>
  );
}

function Progress({ club, book }: { club: ClubDetail; book: ClubBook }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const { data: session } = authClient.useSession();
  const progress = useClubProgress(club.id);
  const me = progress.data?.find((m) => m.userId === session?.user.id);
  const workKey = book.edition.workKey;

  return (
    <Section title={t('clubs.progress.title')}>
      {progress.isPending && <ActivityIndicator color={colors.accent} />}
      {progress.isError && <Notice message={clubErrorMessage(t, progress.error)} />}
      {progress.data && (
        <>
          <View style={{ gap: space.sm }}>
            {me?.reading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' }}>
                <Hint>{`${t('clubs.progress.myReading')}: ${readingLine(t, me.reading)}`}</Hint>
                <TextLink href={{ pathname: '/readings/[id]', params: { id: me.reading.id } }} label={t('clubs.progress.openReading')} />
              </View>
            ) : (
              <>
                <Hint>{t('clubs.progress.notStarted')}</Hint>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  <Button
                    label={t('clubs.progress.startSame')}
                    onPress={() => router.push({ pathname: '/readings/new', params: { editionId: book.edition.id, club: club.id } })}
                  />
                  <Button
                    variant="secondary"
                    label={t('clubs.progress.startOther')}
                    onPress={() =>
                      workKey
                        ? router.push({ pathname: '/books/work/[key]', params: { key: workKey, pick: `read:${club.id}` } })
                        : router.push({ pathname: '/books', params: { pick: `read:${club.id}` } })
                    }
                  />
                </View>
              </>
            )}
          </View>
          <ClubProgress book={book} members={progress.data} myUserId={session?.user.id} />
        </>
      )}
    </Section>
  );
}

function ClubNotes({ club, book }: { club: ClubDetail; book: ClubBook }) {
  const { data: session } = authClient.useSession();
  const progress = useClubProgress(club.id);
  const me = progress.data?.find((m) => m.userId === session?.user.id);
  return <Notes bookKey={bookKeyOf(book.edition)} club={{ id: club.id, name: club.name }} readingId={me?.reading?.id} />;
}
