import { isSpoilerFor, POSITION_SCALE, type Note } from '@bookclub/shared';
import { MessageCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNotes, type NoteScope } from '@/api/notes';
import { whereEveryoneIs, type LineMember } from '@/clubs/where';
import { placeLabel } from '@/notes/format';
import { NoteCard } from '@/components/NoteCard';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { Sheet } from '@/components/ui/Sheet';
import { useTheme } from '@/theme';

const FACE = 28;
/** Faces sit this far above the line on a stem, clear of your ribbon. */
const FACE_LIFT = 26;
const MARK = 26;
/** Marks closer than this (in pixels) share one, with a count, so the line stays readable on a phone. */
const MIN_GAP = 30;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
const percentOf = (position: number) => Math.round((position / POSITION_SCALE) * 100);

export type { LineMember };

function bucket<T>(items: T[], at: (item: T) => number, width: number): { x: number; items: T[] }[] {
  const out: { x: number; items: T[] }[] = [];
  for (const item of [...items].sort((a, b) => at(a) - at(b))) {
    const x = (Math.max(0, Math.min(POSITION_SCALE, at(item))) / POSITION_SCALE) * width;
    const last = out[out.length - 1];
    if (last && x - last.x < MIN_GAP) last.items.push(item);
    else out.push({ x, items: [item] });
  }
  return out;
}

/**
 * The book as one line, first page to last: where you are (the ribbon), where the rest of your club is
 * (their faces), and where people left notes, like comments along a track. Tap a note bubble to read what
 * was said there; notes past your place stay covered until you choose "Show note".
 */
export function BookLine({
  bookKey,
  scope,
  startPage = 1,
  endPage,
  members,
  pace,
}: {
  bookKey: string;
  scope: NoteScope;
  /** Your copy's story pages, for "≈N pages ahead". */
  startPage?: number;
  endPage: number;
  members?: LineMember[];
  pace?: number | null;
}) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const query = useNotes(bookKey, scope);
  const [width, setWidth] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const viewer = query.data?.viewer ?? null;
  const lineWidth = width || 340;
  const notes = useMemo(() => (query.data?.notes ?? []).filter((n) => n.body !== null || n.replies.length > 0), [query.data]);
  const groups = useMemo(() => bucket(notes, (n) => n.position, lineWidth), [notes, lineWidth]);
  // You are the ribbon, never a face, so your place is never merged with (or mistaken for) someone else's.
  const others = useMemo(() => (members ?? []).filter((m) => !m.me), [members]);
  const people = useMemo(() => bucket(others.filter((m) => m.position !== null), (m) => m.position ?? 0, lineWidth), [others, lineWidth]);
  const showFaces = others.length > 0;
  const lineY = showFaces ? FACE + FACE_LIFT + 4 : 24;
  const marksY = lineY + 14;
  const mine = viewer?.position ?? members?.find((m) => m.me)?.position ?? null;
  const you = mine !== null ? mine / POSITION_SCALE : null;
  const pct = (x: number) => `${(x / lineWidth) * 100}%` as const;
  const ahead = (g: Note[]) => g.every((n) => !n.mine && isSpoilerFor(n.position, viewer));
  const placeOf = (g: Note[]) => {
    const first = placeLabel(t, g[0]!, viewer);
    const last = placeLabel(t, g[g.length - 1]!, viewer);
    return first === last ? first : `${first} – ${last}`;
  };
  const open = groups.find((g) => g.items[0]!.id === openKey);
  const preview = Platform.OS === 'web' ? groups.find((g) => g.items[0]!.id === hovered) : undefined;

  return (
    <View style={{ gap: space.xs }}>
      <View role="toolbar" aria-label={t('notes.line.label')} style={{ height: marksY + MARK + 4 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {/* The whole book, and what you've read of it. */}
        <View aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: lineY, height: 1, backgroundColor: colors.control }} />
        {you !== null && <View aria-hidden style={{ position: 'absolute', left: 0, top: lineY - 1, height: 3, borderRadius: 2, width: `${you * 100}%`, backgroundColor: colors.accent }} />}
        {pace != null && (
          <View aria-hidden style={{ position: 'absolute', left: `${(pace / POSITION_SCALE) * 100}%`, top: lineY - 7, height: 15, width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.text }} />
        )}
        {people.map((p) => {
          const face = p.items[0]!;
          return (
            <View
              key={face.userId}
              role="img"
              aria-label={p.items.map((m) => t('notes.line.person', { name: m.name, percent: percentOf(m.position ?? 0) })).join(', ')}
              style={{ position: 'absolute', left: pct(p.x), marginLeft: -FACE / 2, top: lineY - FACE_LIFT - FACE, width: FACE, alignItems: 'center' }}
            >
              <View
                style={{
                  width: FACE,
                  height: FACE,
                  borderRadius: FACE / 2,
                  borderWidth: 1,
                  borderColor: colors.control,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>{initials(face.name)}</Text>
                {p.items.length > 1 && <Badge count={p.items.length} people />}
              </View>
              {/* A stem ties the face to its place on the line. */}
              <View style={{ width: 1, height: FACE_LIFT, backgroundColor: colors.control }} />
            </View>
          );
        })}
        {/* Your place: the ribbon, alone or in a club. */}
        {you !== null && (
          <View aria-hidden style={{ position: 'absolute', top: lineY - 22, left: `${you * 100}%`, marginLeft: -6 }}>
            <Svg width={12} height={26} viewBox="0 0 12 26">
              <Path d="M0 0 H12 V26 L6 20 L0 26 Z" fill={colors.accent} />
            </Svg>
          </View>
        )}
        {groups.map((g) => {
          const isAhead = ahead(g.items);
          const mineGroup = g.items.some((n) => n.mine);
          const key = g.items[0]!.id;
          const label =
            t('notes.line.markLabel', {
              notes: t('notes.timeline.count', { count: g.items.length }),
              place: placeOf(g.items),
              names: [...new Set(g.items.map((n) => (n.mine ? t('notes.line.you') : n.author.name)))].join(', '),
            }) + (isAhead ? t('notes.timeline.markAhead') : '');
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => {
                setMessage(undefined);
                setOpenKey(key);
              }}
              onHoverIn={() => setHovered(key)}
              onHoverOut={() => setHovered((h) => (h === key ? null : h))}
              onFocus={() => setHovered(key)}
              onBlur={() => setHovered((h) => (h === key ? null : h))}
              hitSlop={6}
              style={({ pressed }) => ({
                position: 'absolute',
                left: pct(g.x),
                marginLeft: -MARK / 2,
                top: marksY,
                width: MARK,
                height: MARK,
                borderRadius: MARK / 2,
                borderWidth: mineGroup ? 1.5 : 1,
                borderStyle: isAhead ? 'dashed' : 'solid',
                borderColor: mineGroup ? colors.accent : colors.control,
                backgroundColor: isAhead ? 'transparent' : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <MessageCircle size={13} color={isAhead ? colors.textMuted : colors.text} strokeWidth={2} />
              {g.items.length > 1 && <Badge count={g.items.length} />}
              {/* A short stem ties the bubble to its place on the line. */}
              <View style={{ position: 'absolute', top: -(marksY - lineY), left: MARK / 2 - 0.5, width: 1, height: marksY - lineY, backgroundColor: mineGroup ? colors.accent : colors.control }} />
            </Pressable>
          );
        })}
        {preview && (
          <View
            aria-hidden
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: Math.max(0, Math.min(lineWidth - 260, preview.x - 130)),
              top: marksY + MARK + 6,
              width: Math.min(260, lineWidth),
              zIndex: 2,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: space.sm,
              gap: 2,
              boxShadow: colors.deskShadow,
            }}
          >
            {ahead(preview.items) ? (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{t('notes.timeline.previewAhead', { place: placeOf(preview.items) })}</Text>
            ) : (
              <>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{preview.items[0]!.mine ? t('notes.you') : preview.items[0]!.author.name}</Text>
                  {` · ${placeOf(preview.items)}`}
                </Text>
                <Text numberOfLines={2} style={{ color: colors.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.45 }}>
                  {preview.items[0]!.body ?? t('notes.deleted')}
                </Text>
              </>
            )}
          </View>
        )}
      </View>
      <View aria-hidden style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>p. 1</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{`p. ${viewer?.endPage ?? endPage}`}</Text>
      </View>
      {showFaces && <Hint>{whereEveryoneIs(t, others, mine, Math.max(1, endPage - startPage))}</Hint>}
      <Sheet visible={Boolean(open)} onClose={() => setOpenKey(null)} title={open ? t('notes.line.sheetTitle', { place: placeOf(open.items) }) : ''}>
        {message && <Notice tone="info" message={message} />}
        <View style={{ gap: space.lg, paddingBottom: space.sm }}>
          {open?.items.map((n) => <NoteCard key={n.id} note={n} viewer={viewer} bookKey={bookKey} now={query.dataUpdatedAt} onMessage={setMessage} />)}
        </View>
      </Sheet>
    </View>
  );
}

/** A count on a merged mark: filled for notes, outlined for people, so the two never read alike. */
function Badge({ count, people = false }: { count: number; people?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        right: -6,
        top: -6,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        paddingHorizontal: 3,
        backgroundColor: people ? colors.surface : colors.text,
        borderWidth: people ? 1 : 0,
        borderColor: colors.text,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: people ? colors.text : colors.background, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{count}</Text>
    </View>
  );
}
