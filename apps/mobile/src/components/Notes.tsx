import { isSpoilerFor, positionToPage, type NoteViewer } from '@bookclub/shared';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useClubs } from '@/api/clubs';
import { useNotes, type NoteScope } from '@/api/notes';
import { noteErrorMessage } from '@/notes/errors';
import Svg, { Path } from 'react-native-svg';
import { MARGIN, NoteCard } from '@/components/NoteCard';
import { NoteComposer, type Audience } from '@/components/NoteComposer';
import { Button } from '@/components/ui/Button';
import { Choice } from '@/components/ui/Choice';
import { Notice } from '@/components/ui/Notice';
import { Hint, Section } from '@/components/ui/Section';
import { useTheme } from '@/theme';

interface NotesProps {
  bookKey: string;
  /** The viewer's reading of this book; without one they can read notes but not write them. */
  readingId?: string;
  /** On a club's page: only that club's notes, and new ones go to the club. */
  club?: { id: string; name: string };
  /** On a book's page: only public notes, read-only. */
  publicOnly?: boolean;
}

/** Notes on a book in book order, with a "you are here" line; anything past it is covered. */
export function Notes({ bookKey, readingId, club, publicOnly = false }: NotesProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const clubs = useClubs();
  const myClubs = club
    ? [club]
    : (clubs.data ?? []).filter((c) => c.currentBook?.bookKey === bookKey).map((c) => ({ id: c.id, name: c.name }));
  const fixed: NoteScope | null = club ? `club:${club.id}` : publicOnly ? 'public' : null;
  const [picked, setPicked] = useState<NoteScope>('all');
  const scope = fixed ?? picked;
  const query = useNotes(bookKey, scope);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState<string>();

  const scopes: { value: NoteScope; label: string }[] = [
    { value: 'all', label: t('notes.scopeAll') },
    { value: 'public', label: t('notes.scopePublic') },
    ...myClubs.map((c) => ({ value: `club:${c.id}` as const, label: c.name })),
    { value: 'mine', label: t('notes.scopeMine') },
  ];
  // A club page writes to the club and the public list starts with everyone; elsewhere a club reading
  // this book comes first, then only-me.
  const clubAudiences = myClubs.map((c) => ({ value: `club:${c.id}` as const, label: c.name }));
  const onlyMe = { value: 'private' as const, label: t('notes.audience_private') };
  const everyone = { value: 'public' as const, label: t('notes.audience_public') };
  const audiences: { value: Audience; label: string }[] = club
    ? [{ value: `club:${club.id}`, label: club.name }]
    : publicOnly
      ? [everyone, ...clubAudiences, onlyMe]
      : [...clubAudiences, onlyMe, everyone];

  return (
    <Section title={club ? t('notes.clubTitle') : publicOnly ? t('notes.publicTitle') : t('notes.title')}>
      {readingId ? (
        writing ? (
          <NoteComposer
            readingId={readingId}
            bookKey={bookKey}
            audiences={audiences}
            onCancel={() => setWriting(false)}
            onAdded={() => {
              setWriting(false);
              setMessage(t('notes.added'));
            }}
          />
        ) : (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              variant="secondary"
              label={t('notes.write')}
              onPress={() => {
                setMessage(undefined);
                setWriting(true);
              }}
            />
          </View>
        )
      ) : (
        <Hint>{club ? t('notes.startToWriteClub') : t('notes.startToWrite')}</Hint>
      )}
      {!fixed && <Choice kind="tab" label={t('notes.scopeLabel')} options={scopes} value={scope} onChange={setPicked} />}
      {message && <Notice tone="info" message={message} />}
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={noteErrorMessage(t, query.error)} />}
      {query.data && (
        <NoteList
          {...query.data}
          bookKey={bookKey}
          now={query.dataUpdatedAt}
          onMessage={setMessage}
          empty={scope === 'mine' ? t('notes.emptyMine') : publicOnly || scope === 'public' ? t('notes.emptyPublic') : t('notes.empty')}
        />
      )}
    </Section>
  );
}

function NoteList({
  viewer,
  notes,
  empty,
  ...shared
}: {
  viewer: NoteViewer | null;
  notes: Parameters<typeof NoteCard>[0]['note'][];
  empty: string;
  bookKey: string;
  now: number;
  onMessage: (text: string) => void;
}) {
  const { t } = useTranslation();
  const { space } = useTheme();
  if (notes.length === 0) return <Hint>{empty}</Hint>;
  const firstAhead = viewer ? notes.findIndex((n) => isSpoilerFor(n.position, viewer)) : -1;

  return (
    <View>
      {!viewer && <Hint>{t('notes.notReadingHint')}</Hint>}
      {notes.map((n, i) => (
        <Fragment key={n.id}>
          {i === firstAhead && viewer && <YouAreHere viewer={viewer} />}
          <View style={{ paddingVertical: space.md }}>
            <NoteCard note={n} viewer={viewer} {...shared} />
          </View>
        </Fragment>
      ))}
    </View>
  );
}

/** Where the viewer is: the bookmark ribbon in the margin, and a red line across the page. Notes below it are ahead. */
function YouAreHere({ viewer }: { viewer: NoteViewer }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  return (
    <View accessibilityRole="header" aria-level={3} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.sm }}>
      <View aria-hidden style={{ width: MARGIN, alignItems: 'flex-end' }}>
        <Svg width={12} height={22} viewBox="0 0 12 22">
          <Path d="M0 0 H12 V22 L6 17 L0 22 Z" fill={colors.accent} />
        </Svg>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={{ color: colors.accent, fontFamily: fonts.heading, fontSize: fontSize.sm, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {t('notes.youAreHere', { page: positionToPage(viewer.position, viewer) })}
        </Text>
        <View aria-hidden style={{ flex: 1, height: 1, backgroundColor: colors.accent }} />
      </View>
    </View>
  );
}
