import { paceAt, positionToPage, roleAtLeast, type ClubBook, type ClubDetail, type Meeting, type MemberProgress } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Settings, UserPlus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useClub } from '@/api/clubs';
import { useClubProgress } from '@/api/readings';
import { authClient } from '@/auth/client';
import { formatAuthors } from '@/books/format';
import { openReading, useStartReading } from '@/books/start';
import { clubErrorMessage } from '@/clubs/errors';
import { formatDate, formatMeetingTime } from '@/clubs/format';
import { pacePlan } from '@/clubs/pace';
import { readingLine } from '@/readings/format';
import { Avatar } from '@/components/Avatar';
import { BookCover } from '@/components/BookCover';
import { InviteBody } from '@/components/Invite';
import { MARGIN } from '@/components/NoteCard';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { Sheet } from '@/components/ui/Sheet';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

/**
 * A club: the book it's reading (and your one next step: open it, or start it), who's where, and the
 * meetings. The book itself, with everyone on its line and the club's notes, is the book's own page.
 * Owner and admin tools are behind the gear.
 */
export default function ClubPage() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useClub(id);
  const club = query.data;
  const { data: session } = authClient.useSession();
  const progress = useClubProgress(id, { enabled: Boolean(club?.currentBook) });
  const me = progress.data?.find((m) => m.userId === session?.user.id);
  const [inviting, setInviting] = useState(false);
  const book = club?.currentBook ?? null;

  return (
    <Screen>
      <PageTitle title={club?.name} />
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={clubErrorMessage(t, query.error)} />}
      {club && (
        <View style={{ gap: space.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xs }}>
            <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.headingBold, fontSize: fontSize.xxl, lineHeight: fontSize.xxl * 1.15, color: colors.text }}>
              {club.name}
            </Text>
            <IconButton icon={UserPlus} label={t('clubs.club.invite')} onPress={() => setInviting(true)} />
            <IconButton icon={Settings} label={t('clubs.club.settings')} onPress={() => router.push({ pathname: '/clubs/[id]/settings', params: { id: club.id } })} />
          </View>

          {book ? (
            <>
              <View style={{ gap: space.lg }}>
                <TheBook book={book} />
                <YourStep club={club} book={book} me={me} />
              </View>
              <WhoIsWhere club={club} book={book} progress={progress.data ?? []} myUserId={session?.user.id} onInvite={() => setInviting(true)} />
              <Meetings club={club} book={book} />
            </>
          ) : (
            <NoBook club={club} onInvite={() => setInviting(true)} />
          )}

          <Sheet visible={inviting} onClose={() => setInviting(false)} title={t('clubs.club.invite')}>
            <View style={{ paddingBottom: space.sm }}>
              <InviteBody club={club} />
            </View>
          </Sheet>
        </View>
      )}
    </Screen>
  );
}

function SectionHead({ children }: { children: string }) {
  const { colors, fonts, fontSize } = useTheme();
  return (
    <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.25, color: colors.text }}>
      {children}
    </Text>
  );
}

function TheBook({ book }: { book: ClubBook }) {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const e = book.edition;
  return (
    <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
      <BookCover cover={e.cover} title={e.title} size="md" />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.25, color: colors.text }}>
          {e.title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>{formatAuthors(e.authors)}</Text>
        {book.finishDate && <Hint>{t('clubs.club.finishBy', { date: formatDate(book.finishDate) })}</Hint>}
      </View>
    </View>
  );
}

/** Your one next step: open the book (where you log, read and write), or start it. */
function YourStep({ club, book, me }: { club: ClubDetail; book: ClubBook; me?: MemberProgress }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const start = useStartReading();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (me?.reading) {
    const reading = me.reading;
    return (
      <View style={{ gap: space.sm }}>
        <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{t('clubs.club.youAre', { where: readingLine(t, reading) })}</Text>
        <Button label={t('clubs.club.openBook')} onPress={() => openReading(reading.id)} />
      </View>
    );
  }
  return (
    <View style={{ gap: space.xs }}>
      {error && <Notice message={error} />}
      <Button
        label={t('clubs.club.startBook')}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setError(undefined);
          try {
            await start(book.edition, club.id);
          } catch (err) {
            setError(clubErrorMessage(t, err));
          }
          setBusy(false);
        }}
      />
      <View style={{ alignSelf: 'center' }}>
        <TextButton
          tone="muted"
          label={t('clubs.progress.startOther')}
          onPress={() =>
            book.edition.workKey
              ? router.push({ pathname: '/books/work/[key]', params: { key: book.edition.workKey, pick: `read:${club.id}` } })
              : router.push({ pathname: '/books', params: { pick: `read:${club.id}` } })
          }
        />
      </View>
    </View>
  );
}

/** Everyone in the club and where they are, furthest first; where the club should be today on top. */
function WhoIsWhere({ club, book, progress, myUserId, onInvite }: { club: ClubDetail; book: ClubBook; progress: MemberProgress[]; myUserId?: string; onInvite: () => void }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const [now] = useState(() => Date.now());
  const isAdmin = roleAtLeast(club.myRole, 'admin');
  const where = new Map(progress.map((p) => [p.userId, p.reading]));
  const pace = paceAt(now, pacePlan(book));
  const pages = book.edition.pageCount ?? 0;
  const members = [...club.members].sort((a, b) => (where.get(b.userId)?.position ?? -1) - (where.get(a.userId)?.position ?? -1));
  return (
    <View style={{ gap: space.sm }}>
      <SectionHead>{t('clubs.club.whoIsWhere')}</SectionHead>
      {pace !== null && pace > 0 && <Hint>{t('clubs.club.paceToday', { page: positionToPage(pace, { startPage: 1, endPage: Math.max(pages, 2) }) })}</Hint>}
      <View role="list">
        {members.map((m) => {
          const reading = where.get(m.userId);
          const isMe = m.userId === myUserId;
          const line = [isMe ? t('clubs.progress.you') : null, m.role !== 'member' ? t(`clubs.roles.${m.role}`) : null, reading ? readingLine(t, reading) : t('reading.notStarted')]
            .filter(Boolean)
            .join(' · ');
          const row = (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
              <Avatar id={m.userId} name={m.name} image={m.image} me={isMe} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>{m.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontVariant: ['tabular-nums'] }}>{line}</Text>
              </View>
            </View>
          );
          return (
            <View key={m.userId} role="listitem">
              {isAdmin && !isMe ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${m.name}, ${line}`}
                  onPress={() => router.push({ pathname: '/clubs/[id]/member/[userId]', params: { id: club.id, userId: m.userId } })}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  {row}
                </Pressable>
              ) : (
                row
              )}
            </View>
          );
        })}
      </View>
      <Button variant="secondary" label={t('clubs.club.invite')} onPress={onInvite} />
    </View>
  );
}

function NoBook({ club, onInvite }: { club: ClubDetail; onInvite: () => void }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const isAdmin = roleAtLeast(club.myRole, 'admin');
  return (
    <View style={{ gap: space.md }}>
      <Text style={{ color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{isAdmin ? t('clubs.club.noBookAdmin') : t('clubs.club.noBook')}</Text>
      {isAdmin && <Button label={t('clubs.club.chooseBook')} onPress={() => router.push({ pathname: '/books', params: { pick: `club:${club.id}` } })} />}
      <Button variant="secondary" label={t('clubs.club.invite')} onPress={onInvite} />
    </View>
  );
}

/** Upcoming meetings first (the next one on top), then past ones, faded. */
function Meetings({ club, book }: { club: ClubDetail; book: ClubBook }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const isAdmin = roleAtLeast(club.myRole, 'admin');
  const [now] = useState(() => Date.now());
  const time = (m: Meeting) => new Date(m.startsAt).getTime();
  const upcoming = book.meetings.filter((m) => time(m) >= now).sort((a, b) => time(a) - time(b));
  const past = book.meetings.filter((m) => time(m) < now).sort((a, b) => time(b) - time(a));
  return (
    <View style={{ gap: space.lg }}>
      <SectionHead>{t('clubs.club.meetings')}</SectionHead>
      {book.meetings.length === 0 && <Hint>{t('clubs.club.noMeetings')}</Hint>}
      {[...upcoming, ...past].map((m) => (
        <MeetingRow key={m.id} meeting={m} past={time(m) < now}>
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
      {isAdmin && <Button variant="secondary" label={t('clubs.club.planMeeting')} onPress={() => router.push({ pathname: '/clubs/[id]/meeting', params: { id: club.id } })} />}
    </View>
  );
}

function MeetingRow({ meeting, past, children }: { meeting: Meeting; past: boolean; children?: ReactNode }) {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const date = new Date(meeting.startsAt);
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
  const details = [time, meeting.location, meeting.readToPage ? t('clubs.club.readTo', { page: meeting.readToPage }) : null].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: 'row', gap: space.md, opacity: past ? 0.6 : 1 }}>
      <View aria-hidden style={{ width: MARGIN, alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: fonts.reading, fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.1, color: colors.text, fontVariant: ['oldstyle-nums'] }}>{date.getDate()}</Text>
        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{month}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityLabel={`${formatMeetingTime(meeting.startsAt)}, ${meeting.title}${past ? `, ${t('clubs.club.past')}` : ''}`} style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>
          {meeting.title}
        </Text>
        <Hint>{details}</Hint>
        {children}
      </View>
    </View>
  );
}
