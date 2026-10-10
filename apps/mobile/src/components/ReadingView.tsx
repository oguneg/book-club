import { paceAt, positionToPage, type ClubDetail } from '@bookclub/shared';
import { MoreHorizontal, Plus, Users } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { coverUri } from '@/api/client';
import { useClub, useClubs } from '@/api/clubs';
import { useClubProgress, useReading, useReadingActions } from '@/api/readings';
import { authClient } from '@/auth/client';
import { formatAuthors } from '@/books/format';
import { formatDate, formatMeetingTime } from '@/clubs/format';
import { pacePlan } from '@/clubs/pace';
import { readingErrorMessage } from '@/readings/errors';
import { readingLine } from '@/readings/format';
import { BookCover } from '@/components/BookCover';
import { BookLine, type LineMember } from '@/components/BookLine';
import { BookMenu } from '@/components/BookMenu';
import { FinishedSheet } from '@/components/FinishedSheet';
import { NoteSheet } from '@/components/NoteSheet';
import { NotesFeed } from '@/components/Notes';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { UpdatePageSheet } from '@/components/UpdatePageSheet';
import { Button } from '@/components/ui/Button';
import { Fab } from '@/components/ui/Fab';
import { IconButton } from '@/components/ui/IconButton';
import { NavRow } from '@/components/ui/NavRow';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/Segmented';
import { useTheme } from '@/theme';

/**
 * A book you're reading, as its one page: where you are, one button to update it, the notes along the
 * book and below it, and "+ Note". When your club is reading it, the club is a layer on the same page:
 * everyone's faces on the line, the next meeting, and the club's notes first. Rare things are in ⋯.
 */
export function ReadingView({
  readingId,
  open,
  onOpened,
  pane = false,
}: {
  readingId: string;
  open?: 'update' | 'note';
  onOpened?: () => void;
  /** Beside a list (desktop My books): no header of its own, so ⋯ goes in the page. */
  pane?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const query = useReading(readingId);
  const reading = query.data;
  const actions = useReadingActions(readingId);
  // Arriving with a job to do opens on it: "Where are you?" right after starting, or a note to write.
  const [sheet, setSheet] = useState<'update' | 'note' | 'menu' | 'finished' | null>(open ?? null);
  const [message, setMessage] = useState<string>();
  const [notesFor, setNotesFor] = useState<'club' | 'all'>('club');
  const [before, setBefore] = useState<{ page: number | null; position: number }>();
  const reading_ = reading?.status === 'reading';

  // The club reading this book, if any (the first, in the rare case of two).
  const clubId = useClubs().data?.find((c) => reading && c.currentBook?.bookKey === reading.bookKey)?.id;
  const club = useClub(clubId ?? '', { enabled: Boolean(clubId) }).data;
  const progress = useClubProgress(clubId ?? '', { enabled: Boolean(clubId) }).data;
  const { data: session } = authClient.useSession();
  const [now] = useState(() => Date.now());
  const pace = club?.currentBook ? paceAt(now, pacePlan(club.currentBook)) : null;
  const photos = new Map(club?.members.map((m) => [m.userId, m.image]) ?? []);
  const members: LineMember[] | undefined = progress?.map((m) => ({
    userId: m.userId,
    name: m.name,
    image: photos.get(m.userId) ?? null,
    position: m.reading?.position ?? null,
    me: m.userId === session?.user.id,
  }));
  const scope = club && notesFor === 'club' ? (`club:${club.id}` as const) : 'all';

  useEffect(() => {
    if (open && reading) onOpened?.();
  }, [open, reading, onOpened]);

  // The rare things (finish, stop, pages, remove) wait behind ⋯ in the header.
  const navigation = useNavigation();
  useLayoutEffect(() => {
    if (pane) return;
    navigation.setOptions({ headerRight: () => <IconButton icon={MoreHorizontal} label={t('reading.menu.label')} onPress={() => setSheet('menu')} /> });
  }, [navigation, t, pane]);

  return (
    <Screen region={pane ? reading?.edition.title : undefined} overlay={reading_ ? <Fab icon={Plus} label={t('notes.sheet.fab')} onPress={() => setSheet('note')} /> : undefined}>
      <PageTitle title={reading?.edition.title} />
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={readingErrorMessage(t, query.error)} />}
      {reading && (
        <View style={{ gap: space.xl }}>
          {/* The book, face out, over a soft wash of its own cover: every book's page looks like that book. */}
          <View
            style={{
              marginHorizontal: -space.lg,
              marginTop: -space.sm,
              paddingHorizontal: space.lg,
              paddingTop: space.lg,
              paddingBottom: space.xl,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              overflow: 'hidden',
              backgroundColor: colors.surface,
            }}
          >
            <CoverWash cover={reading.edition.cover} />
            {pane && (
              <View style={{ position: 'absolute', top: space.xs, right: space.xs }}>
                <IconButton icon={MoreHorizontal} label={t('reading.menu.label')} onPress={() => setSheet('menu')} />
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-end' }}>
              <View style={{ borderRadius: 8, boxShadow: '0px 2px 4px rgba(42,33,25,0.14), 0px 14px 28px -12px rgba(42,33,25,0.5)' }}>
                <BookCover cover={reading.edition.cover} title={reading.edition.title} size="lg" />
              </View>
              <View style={{ flex: 1, gap: space.xs, paddingBottom: space.xs }}>
                <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.2, color: colors.text }}>
                  {reading.edition.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>{formatAuthors(reading.edition.authors)}</Text>
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: space.sm }}>{readingLine(t, reading)}</Text>
              </View>
            </View>
          </View>

          <View style={{ gap: space.md }}>
            <BookLine bookKey={reading.bookKey} scope={scope} startPage={reading.startPage} endPage={reading.endPage} members={members} pace={pace} />
            {pace !== null && pace > 0 && (
              // The key to the dashed tick on the line.
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View aria-hidden style={{ height: 15, width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.text }} />
                <Hint>{t('clubs.club.paceToday', { page: positionToPage(pace, { startPage: reading.startPage, endPage: reading.endPage }) })}</Hint>
              </View>
            )}
            {club && <ClubStrip club={club} />}
          </View>

          {reading_ ? (
            <Button label={t('reading.update.button')} onPress={() => setSheet('update')} />
          ) : (
            <View style={{ gap: space.sm }}>
              <Hint>
                {reading.finishedAt
                  ? t('reading.finishedOn', { date: formatDate(reading.finishedAt.slice(0, 10)) })
                  : t('reading.closedStopped')}
              </Hint>
              <Button variant="secondary" label={t('reading.resume')} onPress={() => actions.resume().catch((err) => setMessage(readingErrorMessage(t, err)))} />
            </View>
          )}
          {message && <Notice tone="info" message={message} />}

          <View style={{ gap: space.md }}>
            {club && (
              <Segmented
                label={t('reading.notesFor')}
                options={[
                  { value: 'club', label: t('reading.notesClub') },
                  { value: 'all', label: t('reading.notesEveryone') },
                ]}
                value={notesFor}
                onChange={setNotesFor}
              />
            )}
            <NotesFeed bookKey={reading.bookKey} scope={scope} title={club && notesFor === 'club' ? t('notes.clubTitle') : t('notes.title')} />
          </View>

          <UpdatePageSheet reading={reading} visible={sheet === 'update' && reading_} onClose={() => setSheet(null)} onFinished={() => {
              setBefore(undefined);
              setSheet('finished');
            }}
          />
          <NoteSheet
            readingId={reading.id}
            bookKey={reading.bookKey}
            clubId={club?.id}
            visible={sheet === 'note'}
            onClose={() => setSheet(null)}
            onPosted={() => setMessage(t('notes.added'))}
          />
          <BookMenu
            reading={reading}
            visible={sheet === 'menu'}
            onClose={() => setSheet(null)}
            onFinished={(b) => {
              setBefore(b);
              setSheet('finished');
            }}
          />
          <FinishedSheet
            reading={reading}
            before={before}
            visible={sheet === 'finished'}
            onClose={() => setSheet(null)}
            onLastThought={() => setSheet('note')}
            onReadNotes={() => {
              setNotesFor('all');
              setSheet(null);
            }}
          />
        </View>
      )}
    </Screen>
  );
}

/** The club, one tap away: its name and what's next (the meeting, with what to have read by then). */
function ClubStrip({ club }: { club: ClubDetail }) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());
  const next = club.currentBook?.meetings.find((m) => new Date(m.startsAt).getTime() >= now);
  const detail = next
    ? [t('reading.club.next', { when: formatMeetingTime(next.startsAt) }), next.readToPage ? t('reading.club.readTo', { page: next.readToPage }) : null].filter(Boolean).join(' · ')
    : t('home.members', { count: club.members.length });
  return <NavRow href={{ pathname: '/clubs/[id]', params: { id: club.id } }} icon={Users} title={club.name} detail={detail} />;
}

/** The cover, blurred and faded into the page behind the book's header. */
function CoverWash({ cover }: { cover: string | null }) {
  const { colors, scheme } = useTheme();
  if (!cover) return null;
  return (
    <View aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: coverUri(cover) }}
        blurRadius={36}
        contentFit="cover"
        style={{ position: 'absolute', top: -48, left: -48, right: -48, bottom: -48, opacity: scheme === 'dark' ? 0.4 : 0.55 }}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: scheme === 'dark' ? 0.45 : 0.4 }]} />
    </View>
  );
}
