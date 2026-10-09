import { isSpoilerFor, POSITION_SCALE, type Note, type NoteViewer } from '@bookclub/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNotes, type NoteScope } from '@/api/notes';
import { noteErrorMessage } from '@/notes/errors';
import { placeLabel } from '@/notes/format';
import { NoteCard } from '@/components/NoteCard';
import { useReducedMotion } from '@/components/BookSpan';
import { Notice } from '@/components/ui/Notice';
import { Hint, Section } from '@/components/ui/Section';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

const LINE_Y = 22;
const MARK = 24;
const MARK_Y = LINE_Y + 10;
/** Marks closer than this (in pixels) share one mark with a count, so the line stays readable on a phone. */
const MIN_GAP = MARK + 4;

interface Group {
  key: string;
  x: number;
  notes: Note[];
  ahead: boolean;
  mine: boolean;
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

/** Notes close together on the line share a mark; the line's own width decides what "close" is. */
function groupNotes(notes: Note[], width: number, viewer: NoteViewer | null): Group[] {
  const groups: Group[] = [];
  for (const n of notes) {
    const x = (Math.max(0, Math.min(POSITION_SCALE, n.position)) / POSITION_SCALE) * width;
    const last = groups[groups.length - 1];
    if (last && x - last.x < MIN_GAP) {
      last.notes.push(n);
    } else {
      groups.push({ key: n.id, x, notes: [n], ahead: true, mine: false });
    }
  }
  for (const g of groups) {
    g.ahead = g.notes.every((n) => !n.mine && isSpoilerFor(n.position, viewer));
    g.mine = g.notes.some((n) => n.mine);
  }
  return groups;
}

/**
 * The club's notes as marks along the book, like comments on a track: who left a thought, and where. Your
 * ribbon shows where you are; marks past it are dashed and blurred, and their notes stay covered until you
 * choose "Show note". Tap a mark to read its notes below the line; on the web, hovering previews it.
 */
export function NoteTimeline({ bookKey, scope, endPage }: { bookKey: string; scope: NoteScope; endPage: number }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const query = useNotes(bookKey, scope);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const reduced = useReducedMotion();
  const viewer = query.data?.viewer ?? null;
  const notes = useMemo(() => (query.data?.notes ?? []).filter((n) => n.body !== null || n.replies.length > 0), [query.data]);
  // Marks are placed by percentage, so they show before anything is measured; the measured width (a phone's,
  // until it arrives) only decides which marks are close enough to merge.
  const lineWidth = width || 340;
  const groups = useMemo(() => groupNotes(notes, lineWidth, viewer), [notes, lineWidth, viewer]);
  // A selected mark can merge or vanish when notes change; follow it by any of its notes.
  const open = groups.find((g) => g.key === selected || g.notes.some((n) => n.id === selected));
  const preview = Platform.OS === 'web' ? groups.find((g) => g.key === hovered) : undefined;
  const you = viewer ? viewer.position / POSITION_SCALE : null;
  const place = (g: Group) => {
    const first = placeLabel(t, g.notes[0]!, viewer);
    const last = placeLabel(t, g.notes[g.notes.length - 1]!, viewer);
    return first === last ? first : `${first} – ${last}`;
  };

  return (
    <Section title={t('notes.timeline.title')}>
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={noteErrorMessage(t, query.error)} />}
      {query.data && notes.length === 0 && <Hint>{t('notes.timeline.empty')}</Hint>}
      {query.data && notes.length > 0 && (
        <>
          <Hint>{t('notes.timeline.hint')}</Hint>
          <View role="toolbar" aria-label={t('notes.timeline.title')} style={{ height: MARK_Y + MARK + 22 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {/* The book, and what you've read of it. */}
            <View aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: LINE_Y, height: 1, backgroundColor: colors.control }} />
            {you !== null && (
              <View
                aria-hidden
                style={{ position: 'absolute', left: 0, top: LINE_Y - 1, height: 3, borderRadius: 2, width: `${you * 100}%`, backgroundColor: colors.accent }}
              />
            )}
            {you !== null && (
              <View aria-hidden style={{ position: 'absolute', top: LINE_Y - 20, left: `${you * 100}%`, marginLeft: -6 }}>
                <Svg width={12} height={26} viewBox="0 0 12 26">
                  <Path d="M0 0 H12 V26 L6 20 L0 26 Z" fill={colors.accent} />
                </Svg>
              </View>
            )}
            {groups.map((g) => (
              <Mark
                key={g.key}
                group={g}
                selected={open?.key === g.key}
                width={lineWidth}
                reduced={reduced}
                label={
                  t('notes.timeline.markLabel', {
                    notes: t('notes.timeline.count', { count: g.notes.length }),
                    place: place(g),
                    names: [...new Set(g.notes.map((n) => (n.mine ? t('notes.timeline.you') : n.author.name)))].join(', '),
                  }) + (g.ahead ? t('notes.timeline.markAhead') : '')
                }
                onPress={() => {
                  setMessage(undefined);
                  setSelected(open?.key === g.key ? null : g.key);
                }}
                onHover={(on) => setHovered((h) => (on ? g.key : h === g.key ? null : h))}
              />
            ))}
            <Text aria-hidden style={{ position: 'absolute', left: 0, bottom: 0, color: colors.textMuted, fontSize: fontSize.xs }}>
              p. 1
            </Text>
            <Text aria-hidden style={{ position: 'absolute', right: 0, bottom: 0, color: colors.textMuted, fontSize: fontSize.xs }}>
              {`p. ${viewer?.endPage ?? endPage}`}
            </Text>
            {preview && preview.key !== open?.key && <Preview group={preview} width={lineWidth} place={place(preview)} />}
          </View>
          {message && <Notice tone="info" message={message} />}
          {open && (
            <View accessibilityLiveRegion="polite" style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
                <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '600' }}>
                  {`${t('notes.timeline.at', { place: place(open) })} · ${t('notes.timeline.count', { count: open.notes.length })}`}
                </Text>
                <TextButton tone="muted" label={t('notes.timeline.close')} onPress={() => setSelected(null)} />
              </View>
              {open.notes.map((n) => (
                <NoteCard key={n.id} note={n} viewer={viewer} bookKey={bookKey} now={query.dataUpdatedAt} onMessage={setMessage} />
              ))}
            </View>
          )}
        </>
      )}
    </Section>
  );
}

function Mark({
  group,
  selected,
  width,
  reduced,
  label,
  onPress,
  onHover,
}: {
  group: Group;
  selected: boolean;
  width: number;
  reduced: boolean;
  label: string;
  onPress: () => void;
  onHover: (on: boolean) => void;
}) {
  const { colors, fonts } = useTheme();
  const first = group.notes[0]!;
  const left = `${(group.x / width) * 100}%` as const;
  const ring = selected ? colors.accent : group.mine ? colors.accent : colors.control;
  const fill = selected ? colors.accent : group.ahead ? 'transparent' : colors.surface;
  const ink = selected ? colors.onAccent : group.ahead ? colors.textMuted : colors.text;
  const hide = group.ahead && !selected;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onHoverIn={() => onHover(true)}
      onHoverOut={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      hitSlop={6}
      style={({ pressed }) => ({ position: 'absolute', left, marginLeft: -MARK / 2, top: MARK_Y - MARK / 2, width: MARK, height: MARK, opacity: pressed ? 0.7 : 1 })}
    >
      {/* A short stem ties the mark to its place on the line. */}
      <View style={{ position: 'absolute', left: MARK / 2, top: -(MARK_Y - MARK / 2 - LINE_Y), width: 1, height: MARK_Y - MARK / 2 - LINE_Y, backgroundColor: ring }} />
      <View
        style={[
          {
            width: MARK,
            height: MARK,
            borderRadius: MARK / 2,
            borderWidth: group.mine || selected ? 1.5 : 1,
            borderStyle: group.ahead && !selected ? 'dashed' : 'solid',
            borderColor: ring,
            backgroundColor: fill,
            alignItems: 'center',
            justifyContent: 'center',
          },
          !reduced && Platform.OS === 'web' ? ({ transitionProperty: 'background-color, border-color', transitionDuration: '150ms' } as object) : null,
        ]}
      >
        <Text
          style={[
            { color: ink, fontFamily: fonts.heading, fontSize: 10, letterSpacing: 0.3 },
            // Notes ahead of you: you see that someone wrote here, not who said what.
            hide && Platform.OS === 'web' ? ({ filter: 'blur(2px)', userSelect: 'none' } as object) : null,
            hide && Platform.OS !== 'web' ? { opacity: 0 } : null,
          ]}
        >
          {initials(first.author.name)}
        </Text>
      </View>
      {group.notes.length > 1 && (
        <View
          style={{
            position: 'absolute',
            right: -6,
            top: -6,
            minWidth: 15,
            height: 15,
            borderRadius: 8,
            paddingHorizontal: 3,
            backgroundColor: colors.text,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.background, fontSize: 9, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{group.notes.length}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** What hovering a mark shows: who and where, and the start of the note unless it's ahead of you. */
function Preview({ group, width, place }: { group: Group; width: number; place: string }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space } = useTheme();
  const w = Math.min(260, width);
  const left = Math.max(0, Math.min(width - w, group.x - w / 2));
  const first = group.notes[0]!;
  return (
    <View
      aria-hidden
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top: MARK_Y + MARK / 2 + 6,
        width: w,
        zIndex: 2,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: space.sm,
        gap: 2,
        boxShadow: colors.deskShadow,
      }}
    >
      {group.ahead ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{t('notes.timeline.previewAhead', { place })}</Text>
      ) : (
        <>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{first.mine ? t('notes.you') : first.author.name}</Text>
            {` · ${place}${group.notes.length > 1 ? ` · ${t('notes.timeline.count', { count: group.notes.length })}` : ''}`}
          </Text>
          <Text numberOfLines={2} style={{ color: colors.text, fontFamily: fonts.reading, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 }}>
            {first.body ?? t('notes.deleted')}
          </Text>
        </>
      )}
    </View>
  );
}
