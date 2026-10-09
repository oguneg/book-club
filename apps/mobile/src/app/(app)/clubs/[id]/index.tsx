import { bookKeyOf, formatInviteCode, paceAt, positionToPage, roleAtLeast, type ClubBook, type ClubDetail, type Meeting, type MemberProgress } from '@bookclub/shared';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, Settings, UserPlus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useClub } from '@/api/clubs';
import { useClubProgress } from '@/api/readings';
import { appUrl, authClient } from '@/auth/client';
import { formatAuthors } from '@/books/format';
import { useStartReading } from '@/books/start';
import { clubErrorMessage } from '@/clubs/errors';
import { formatDate, formatMeetingTime } from '@/clubs/format';
import { readingLine } from '@/readings/format';
import { BookCover } from '@/components/BookCover';
import { BookLine, type LineMember } from '@/components/BookLine';
import { pacePlan } from '@/clubs/pace';
import { MARGIN } from '@/components/NoteCard';
import { NotesFeed } from '@/components/Notes';
import { NoteSheet } from '@/components/NoteSheet';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { UpdatePageSheet } from '@/components/UpdatePageSheet';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Fab } from '@/components/ui/Fab';
import { IconButton } from '@/components/ui/IconButton';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { TextButton } from '@/components/ui/TextButton';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

type Tab = 'notes' | 'meetings' | 'members';

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

/**
 * A club: the book, everyone on one line (faces where they are, notes where they were left), your one
 * next step (start the book, or update your page), the next meeting, then Notes · Meetings · Members.
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
  const [sheet, setSheet] = useState<'update' | 'note' | 'invite' | null>(null);
  const [tab, setTab] = useState<Tab>('notes');
  const [message, setMessage] = useState<string>();
  const book = club?.currentBook ?? null;
  const canWrite = Boolean(book && me?.reading?.status === 'reading');

  return (
    <Screen overlay={canWrite ? <Fab icon={Plus} label={t('notes.sheet.fab')} onPress={() => setSheet('note')} /> : undefined}>
      <PageTitle title={club?.name} />
      <BackButton label={t('tabs.clubs')} fallback="/clubs" />
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={clubErrorMessage(t, query.error)} />}
      {club && (
        <View style={{ gap: space.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xs }}>
            <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.headingBold, fontSize: fontSize.xxl, lineHeight: fontSize.xxl * 1.15, color: colors.text }}>
              {club.name}
            </Text>
            <IconButton icon={UserPlus} label={t('clubs.club.invite')} onPress={() => setSheet('invite')} />
            <IconButton icon={Settings} label={t('clubs.club.settings')} onPress={() => router.push({ pathname: '/clubs/[id]/settings', params: { id: club.id } })} />
          </View>

          {book ? (
            <>
              <TheBook book={book} />
              {progress.data && <TheLine club={club} book={book} members={progress.data} myUserId={session?.user.id} />}
              <NextStep club={club} book={book} me={me} onUpdate={() => setSheet('update')} />
              {message && <Notice tone="info" message={message} />}
              <NextMeeting book={book} />
              <Segmented
                label={t('clubs.club.sections')}
                options={[
                  { value: 'notes', label: t('clubs.club.tabNotes') },
                  { value: 'meetings', label: t('clubs.club.meetings') },
                  { value: 'members', label: t('clubs.club.members') },
                ]}
                value={tab}
                onChange={setTab}
              />
              {tab === 'notes' && <NotesFeed bookKey={bookKeyOf(book.edition)} scope={`club:${club.id}`} title={t('notes.clubTitle')} />}
              {tab === 'meetings' && <Meetings club={club} book={book} />}
              {tab === 'members' && <Members club={club} progress={progress.data ?? []} myUserId={session?.user.id} onInvite={() => setSheet('invite')} />}
            </>
          ) : (
            <NoBook club={club} onInvite={() => setSheet('invite')} />
          )}

          <InviteSheet club={club} visible={sheet === 'invite'} onClose={() => setSheet(null)} />
          {me?.reading && (
            <UpdatePageSheet
              reading={{ id: me.reading.id, endPage: me.reading.endPage, currentPage: me.reading.currentPage }}
              visible={sheet === 'update'}
              onClose={() => setSheet(null)}
            />
          )}
          {me?.reading && book && (
            <NoteSheet
              readingId={me.reading.id}
              bookKey={bookKeyOf(book.edition)}
              clubId={club.id}
              visible={sheet === 'note'}
              onClose={() => setSheet(null)}
              onPosted={() => setMessage(t('notes.added'))}
            />
          )}
        </View>
      )}
    </Screen>
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

/** Everyone on the book, and in plain words where the club should be today. */
function TheLine({ club, book, members, myUserId }: { club: ClubDetail; book: ClubBook; members: MemberProgress[]; myUserId?: string }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  // Captured once per visit; the pace moves by the day.
  const [now] = useState(() => Date.now());
  const pace = paceAt(now, pacePlan(book));
  const pages = book.edition.pageCount ?? 0;
  const line: LineMember[] = members.map((m) => ({ userId: m.userId, name: m.name, position: m.reading?.position ?? null, me: m.userId === myUserId }));
  return (
    <View style={{ gap: space.sm }}>
      <BookLine bookKey={bookKeyOf(book.edition)} scope={`club:${club.id}`} endPage={pages} members={line} pace={pace} />
      {pace !== null && pace > 0 && book.finishDate && (
        // Doubles as the legend for the dashed tick on the line.
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View aria-hidden style={{ height: 15, width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.text }} />
          <Hint>{t('clubs.club.paceToday', { page: positionToPage(pace, { startPage: 1, endPage: Math.max(pages, 2) }) })}</Hint>
        </View>
      )}
    </View>
  );
}

/** Your one next step in this club: start the book, or update where you are. */
function NextStep({ club, book, me, onUpdate }: { club: ClubDetail; book: ClubBook; me?: MemberProgress; onUpdate: () => void }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const start = useStartReading();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (me?.reading) {
    return (
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{t('clubs.club.youAre', { where: readingLine(t, me.reading) })}</Text>
          <TextLink href={{ pathname: '/readings/[id]', params: { id: me.reading.id } }} label={t('clubs.club.yourBook')} />
        </View>
        {me.reading.status === 'reading' && <Button label={t('reading.update.button')} onPress={onUpdate} />}
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

function NextMeeting({ book }: { book: ClubBook }) {
  const { t } = useTranslation();
  const { colors, fontSize, radius, space } = useTheme();
  const [now] = useState(() => Date.now());
  const next = book.meetings.find((m) => new Date(m.startsAt).getTime() >= now);
  if (!next) return null;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: 2, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{t('clubs.club.nextMeetingLabel')}</Text>
      <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>{`${formatMeetingTime(next.startsAt)} · ${next.title}`}</Text>
      {(next.location || next.readToPage) && <Hint>{[next.location, next.readToPage ? t('clubs.club.readTo', { page: next.readToPage }) : null].filter(Boolean).join(' · ')}</Hint>}
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

function Meetings({ club, book }: { club: ClubDetail; book: ClubBook }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const isAdmin = roleAtLeast(club.myRole, 'admin');
  const [now] = useState(() => Date.now());
  return (
    <View style={{ gap: space.lg }}>
      {book.meetings.length === 0 && <Hint>{t('clubs.club.noMeetings')}</Hint>}
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
      {isAdmin && <Button variant="secondary" label={t('clubs.club.planMeeting')} onPress={() => router.push({ pathname: '/clubs/[id]/meeting', params: { id: club.id } })} />}
    </View>
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
        <Text accessibilityLabel={`${formatMeetingTime(meeting.startsAt)}, ${meeting.title}${past ? `, ${t('clubs.club.past')}` : ''}`} style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>
          {meeting.title}
        </Text>
        <Hint>{details}</Hint>
        {children}
      </View>
    </View>
  );
}

/** Who's in the club and where each of them is: the text version of the line above. */
function Members({ club, progress, myUserId, onInvite }: { club: ClubDetail; progress: MemberProgress[]; myUserId?: string; onInvite: () => void }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const isAdmin = roleAtLeast(club.myRole, 'admin');
  const where = new Map(progress.map((p) => [p.userId, p.reading]));
  return (
    <View style={{ gap: space.xs }}>
      {club.members.map((m) => {
        const reading = where.get(m.userId);
        const isMe = m.userId === myUserId;
        const line = [isMe ? t('clubs.progress.you') : null, m.role !== 'member' ? t(`clubs.roles.${m.role}`) : null, reading ? readingLine(t, reading) : t('reading.notStarted')]
          .filter(Boolean)
          .join(' · ');
        const row = (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
            <View aria-hidden style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isMe ? colors.accent : colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: isMe ? colors.onAccent : colors.text, fontSize: 11, fontWeight: '700' }}>{initialsOf(m.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>{m.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontVariant: ['tabular-nums'] }}>{line}</Text>
            </View>
          </View>
        );
        return isAdmin && !isMe ? (
          <Pressable
            key={m.userId}
            accessibilityRole="button"
            accessibilityLabel={`${m.name}, ${line}`}
            onPress={() => router.push({ pathname: '/clubs/[id]/member/[userId]', params: { id: club.id, userId: m.userId } })}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            {row}
          </Pressable>
        ) : (
          <View key={m.userId}>{row}</View>
        );
      })}
      <View style={{ marginTop: space.md }}>
        <Button variant="secondary" label={t('clubs.club.invite')} onPress={onInvite} />
      </View>
    </View>
  );
}

/** The way in for friends: the link to send, and the code to read out. */
function InviteSheet({ club, visible, onClose }: { club: ClubDetail; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const [copied, setCopied] = useState(false);
  const link = appUrl(`/join/${formatInviteCode(club.inviteCode)}`);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('clubs.club.invite')}>
      <View style={{ gap: space.md, paddingBottom: space.sm }}>
        <Text style={{ color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{t('clubs.invite.sheetBody')}</Text>
        <Button
          label={copied ? t('clubs.club.copied') : t('clubs.club.copyLink')}
          onPress={async () => {
            await Clipboard.setStringAsync(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        />
        <Text selectable style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' }}>
          {link}
        </Text>
        <View style={{ alignItems: 'center', gap: 2, marginTop: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{t('clubs.invite.orCode')}</Text>
          <Text selectable style={{ color: colors.text, fontFamily: fonts.headingBold, fontSize: fontSize.xl, letterSpacing: 2 }}>
            {formatInviteCode(club.inviteCode)}
          </Text>
        </View>
        <Hint>{t('clubs.club.inviteBody', { count: club.members.length, cap: club.memberCap })}</Hint>
      </View>
    </Sheet>
  );
}
