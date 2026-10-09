import { bookKeyOf, formatInviteCode, roleAtLeast, type ClubBook, type ClubDetail, type Meeting } from '@bookclub/shared';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useClub, useClubActions } from '@/api/clubs';
import { useClubProgress } from '@/api/readings';
import { appUrl, authClient } from '@/auth/client';
import { formatAuthors } from '@/books/format';
import { clubErrorMessage } from '@/clubs/errors';
import { formatDate, formatMeetingTime } from '@/clubs/format';
import { BookCover } from '@/components/BookCover';
import { BookRow } from '@/components/BookRow';
import { ClubProgress } from '@/components/ClubProgress';
import { Columns } from '@/components/Columns';
import { MARGIN } from '@/components/NoteCard';
import { Notes } from '@/components/Notes';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Notice } from '@/components/ui/Notice';
import { Hint, Section } from '@/components/ui/Section';
import { TextButton } from '@/components/ui/TextButton';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

/**
 * A club's room: the book, where everyone is against the pace, and the club's notes. Meetings, members and
 * (for owners and admins) the club's management sit beside it, or below on a phone.
 */
export default function ClubPage() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useClub(id);
  const club = query.data;

  return (
    <Screen width="wide">
      <PageTitle title={club?.name} />
      <BackLink href="/" label={t('appName')} />
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={clubErrorMessage(t, query.error)} />}
      {club && (
        <>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, lineHeight: fontSize.xxl * 1.15, color: colors.text }}>
            {club.name}
          </Text>
          {club.description && (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5, marginTop: space.sm, maxWidth: 560 }}>{club.description}</Text>
          )}
          <View style={{ marginTop: space.xl }}>
            <Columns
              railLabel={t('clubs.club.aboutClub')}
              main={
                <>
                  <TheBook club={club} />
                  {club.currentBook && <Progress club={club} book={club.currentBook} />}
                  {club.currentBook && <ClubNotes club={club} book={club.currentBook} />}
                </>
              }
              rail={
                <>
                  {club.currentBook && <Meetings club={club} book={club.currentBook} />}
                  <Members club={club} />
                  {roleAtLeast(club.myRole, 'admin') ? (
                    <Manage club={club} />
                  ) : (
                    <View style={{ alignSelf: 'flex-start' }}>
                      <TextLink href={{ pathname: '/clubs/[id]/settings', params: { id: club.id } }} label={t('clubs.club.settings')} />
                    </View>
                  )}
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
                </>
              }
            />
          </View>
        </>
      )}
    </Screen>
  );
}

/** The club's book: what, by when, and the next meeting in one line. */
function TheBook({ club }: { club: ClubDetail }) {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  // Captured once per visit: which meeting is next only matters at page-load granularity.
  const [now] = useState(() => Date.now());
  const book = club.currentBook;

  if (!book) {
    return (
      <Section title={t('clubs.club.currentBook')}>
        <Hint>{t('clubs.club.noBook')}</Hint>
        {roleAtLeast(club.myRole, 'admin') && (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button label={t('clubs.club.chooseBook')} onPress={() => router.push({ pathname: '/books', params: { pick: `club:${club.id}` } })} />
          </View>
        )}
      </Section>
    );
  }

  const e = book.edition;
  const next = book.meetings.find((m) => new Date(m.startsAt).getTime() >= now);
  return (
    <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' }}>
      <BookCover cover={e.cover} title={e.title} size="md" />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.25, color: colors.text }}>
          {e.title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>{formatAuthors(e.authors)}</Text>
        <Hint>
          {[t('clubs.club.started', { date: formatDate(book.startDate) }), book.finishDate ? t('clubs.club.finishBy', { date: formatDate(book.finishDate) }) : null]
            .filter(Boolean)
            .join(' · ')}
        </Hint>
        {next && (
          <Text style={{ color: colors.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5, marginTop: space.xs }}>
            {[t('clubs.club.nextMeetingIs', { when: formatMeetingTime(next.startsAt) }), next.location, next.readToPage ? t('clubs.club.readTo', { page: next.readToPage }) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>
    </View>
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
    <Section
      title={t('clubs.progress.title')}
      action={me?.reading ? <TextLink href={{ pathname: '/readings/[id]', params: { id: me.reading.id } }} label={t('clubs.progress.openReading')} /> : undefined}
    >
      {progress.isPending && <ActivityIndicator color={colors.accent} />}
      {progress.isError && <Notice message={clubErrorMessage(t, progress.error)} />}
      {progress.data && (
        <>
          {!me?.reading && (
            <View style={{ gap: space.sm }}>
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
            </View>
          )}
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

/** The club's meetings as an agenda: the date in the margin, like the page numbers beside notes. */
function Meetings({ club, book }: { club: ClubDetail; book: ClubBook }) {
  const { space } = useTheme();
  const { t } = useTranslation();
  const isAdmin = roleAtLeast(club.myRole, 'admin');
  const [now] = useState(() => Date.now());

  return (
    <Section title={t('clubs.club.meetings')}>
      {book.meetings.length === 0 && <Hint>{t('clubs.club.noMeetings')}</Hint>}
      <View style={{ gap: space.lg }}>
        {book.meetings.map((m) => (
          <MeetingRow key={m.id} meeting={m} past={new Date(m.startsAt).getTime() < now}>
            {isAdmin && (
              <View style={{ alignSelf: 'flex-start' }}>
                <TextButton
                  tone="muted"
                  label={t('clubs.meeting.editShort')}
                  accessibilityLabel={t('clubs.meeting.editLabel', { title: m.title })}
                  onPress={() => router.push({ pathname: '/clubs/[id]/meeting', params: { id: club.id, meetingId: m.id } })}
                />
              </View>
            )}
          </MeetingRow>
        ))}
      </View>
      {isAdmin && (
        <View style={{ alignSelf: 'flex-start' }}>
          <TextButton label={t('clubs.club.planMeeting')} onPress={() => router.push({ pathname: '/clubs/[id]/meeting', params: { id: club.id } })} />
        </View>
      )}
    </Section>
  );
}

function MeetingRow({ meeting, past, children }: { meeting: Meeting; past: boolean; children?: ReactNode }) {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const date = new Date(meeting.startsAt);
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  const details = [time, meeting.location, meeting.readToPage ? t('clubs.club.readTo', { page: meeting.readToPage }) : null].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: 'row', gap: space.md, opacity: past ? 0.6 : 1 }}>
      <View aria-hidden style={{ width: MARGIN, alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: fonts.reading, fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.1, color: colors.text, fontVariant: ['oldstyle-nums'] }}>{date.getDate()}</Text>
        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{month}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          accessibilityLabel={`${formatMeetingTime(meeting.startsAt)}, ${meeting.title}${past ? `, ${t('clubs.club.past')}` : ''}`}
          style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}
        >
          {meeting.title}
        </Text>
        <Hint>{details}</Hint>
        {children}
      </View>
    </View>
  );
}

/** Who's in the club, and the way in for whoever isn't yet. */
function Members({ club }: { club: ClubDetail }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const isAdmin = roleAtLeast(club.myRole, 'admin');
  const [copied, setCopied] = useState(false);
  const link = appUrl(`/join/${formatInviteCode(club.inviteCode)}`);

  return (
    <Section title={t('clubs.club.membersCount', { count: club.members.length })}>
      <View style={{ gap: space.xs }}>
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
      </View>
      <View style={{ gap: space.xs, marginTop: space.sm }}>
        <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '600' }}>{t('clubs.club.invite')}</Text>
        <Hint>{t('clubs.club.inviteBody', { count: club.members.length, cap: club.memberCap })}</Hint>
        <Text selectable style={{ color: colors.text, fontSize: fontSize.sm }}>
          {link}
        </Text>
        <Hint>{t('clubs.club.code', { code: formatInviteCode(club.inviteCode) })}</Hint>
        <View style={{ alignSelf: 'flex-start', marginTop: space.xs }}>
          <Button
            variant="secondary"
            label={copied ? t('clubs.club.copied') : t('clubs.club.copyLink')}
            onPress={async () => {
              await Clipboard.setStringAsync(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          />
        </View>
      </View>
    </Section>
  );
}

/** Owner and admin tools, together and out of the members' way. */
function Manage({ club }: { club: ClubDetail }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const actions = useClubActions(club.id);
  const [error, setError] = useState<string>();
  const pick = () => router.push({ pathname: '/books', params: { pick: `club:${club.id}` } });

  return (
    <Section title={t('clubs.club.manage')}>
      {error && <Notice message={error} />}
      <View style={{ gap: space.xs, alignItems: 'flex-start' }}>
        {club.currentBook && (
          <TextButton label={t('clubs.club.changeDates')} onPress={() => router.push({ pathname: '/clubs/[id]/book', params: { id: club.id } })} />
        )}
        <TextButton label={club.currentBook ? t('clubs.club.changeBook') : t('clubs.club.chooseBook')} onPress={pick} />
        {club.currentBook && (
          <ConfirmButton
            quiet
            label={t('clubs.club.finish')}
            question={t('clubs.club.finishQuestion')}
            confirmLabel={t('clubs.club.finishConfirm')}
            onConfirm={() => actions.finishBook().catch((err) => setError(clubErrorMessage(t, err)))}
          />
        )}
        <ConfirmButton quiet label={t('clubs.club.newLink')} question={t('clubs.club.newLinkQuestion')} confirmLabel={t('clubs.club.newLinkConfirm')} onConfirm={() => actions.rotateInvite()} />
        <TextLink href={{ pathname: '/clubs/[id]/settings', params: { id: club.id } }} label={t('clubs.club.settings')} />
      </View>
    </Section>
  );
}

