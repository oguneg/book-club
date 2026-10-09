import { isSpoilerFor, MAX_NOTE_LENGTH, notePlace, REACTIONS, type Note, type NoteReply, type NoteViewer } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useBlockActions, useNoteActions, type ReportReason } from '@/api/notes';
import { noteErrorMessage } from '@/notes/errors';
import { noteTime, placeLabel } from '@/notes/format';
import { useRevealed } from '@/notes/revealed';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextButton } from '@/components/ui/TextButton';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';

interface Shared {
  bookKey: string;
  /** When the list was fetched, for "5 min ago". */
  now: number;
  /** A message for the list: the note itself may be gone (reported, blocked). */
  onMessage: (text: string) => void;
}

/** A note in book order: who, where, for whom; blurred when it is past where the viewer is reading. */
export function NoteCard({ note, viewer, ...shared }: Shared & { note: Note; viewer: NoteViewer | null }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const [revealed, reveal] = useRevealed(note.id);
  const [replying, setReplying] = useState(false);
  const hidden = !note.mine && isSpoilerFor(note.position, viewer) && !revealed;
  const audience = note.visibility === 'club' ? (note.club?.name ?? t('notes.audience_club')) : t(`notes.audience_${note.visibility}`);
  const place = placeLabel(t, note, viewer);

  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <MarginFigure note={note} viewer={viewer} />
      <View style={{ flex: 1, minWidth: 0, gap: space.md }}>
        <Entry
          {...shared}
          entry={note}
          details={[audience]}
          place={place}
          spoiler={hidden ? (viewer ? t('notes.spoilerAhead') : t('notes.spoilerUnknown')) : undefined}
          onReveal={reveal}
          onReply={note.body !== null ? () => setReplying((r) => !r) : undefined}
        />
        {!hidden && (note.replies.length > 0 || replying) && (
          <View style={{ paddingLeft: space.md, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.control, gap: space.md }}>
            {note.replies.map((r) => (
              <Entry key={r.id} {...shared} entry={r} details={[]} />
            ))}
            {replying && <ReplyForm noteId={note.id} bookKey={shared.bookKey} onDone={() => setReplying(false)} />}
          </View>
        )}
      </View>
    </View>
  );
}

/** Width of the margin where page numbers sit, beside notes and the "you are here" ribbon. */
export const MARGIN = 48;

/**
 * The note's place, set in the margin like a reader's pencilled page number: the page in your own copy,
 * "≈" when converted from another edition, or a percentage when we can't know your page.
 */
function MarginFigure({ note, viewer }: { note: Note; viewer: NoteViewer | null }) {
  const { colors, fonts, fontSize } = useTheme();
  const place = notePlace(note, viewer);
  const figure = { fontFamily: fonts.reading, color: colors.text, fontVariant: ['oldstyle-nums' as const], textAlign: 'right' as const };
  return (
    <View aria-hidden style={{ width: MARGIN, alignItems: 'flex-end', paddingTop: 1 }}>
      {place.page !== null ? (
        <>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{place.approximate ? '≈ p.' : 'p.'}</Text>
          <Text style={[figure, { fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.1 }]}>{place.page}</Text>
        </>
      ) : (
        <Text style={[figure, { fontSize: fontSize.md }]}>{`${place.percent}%`}</Text>
      )}
    </View>
  );
}

type Panel = 'none' | 'react' | 'more' | 'edit' | 'delete' | 'report' | 'block';
const REPORT_REASONS: ReportReason[] = ['spoiler', 'offensive', 'spam', 'other'];

/** A note or a reply: header, text, reactions, and what the viewer may do with it. */
function Entry({
  entry,
  details,
  place,
  spoiler,
  onReveal,
  onReply,
  bookKey,
  now,
  onMessage,
}: Shared & {
  entry: NoteReply;
  /** Shown after the author: the audience (top-level notes only). */
  details: string[];
  /** Where in the book (drawn in the margin; read out here for screen readers). */
  place?: string;
  /** Set when the text is covered as a spoiler: what the cover says. */
  spoiler?: string;
  onReveal?: () => void;
  onReply?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const actions = useNoteActions(bookKey);
  const blocks = useBlockActions();
  const [panel, setPanel] = useState<Panel>('none');
  const [draft, setDraft] = useState(entry.body ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const name = entry.mine ? t('notes.you') : entry.author.name;
  const meta = [...details, noteTime(t, entry.createdAt, now), entry.editedAt ? t('notes.edited') : null].filter(Boolean).join(' · ');

  const toggle = (p: Panel) => {
    setError(undefined);
    setPanel((current) => (current === p ? 'none' : p));
  };
  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setPanel('none');
      if (done) onMessage(done);
    } catch (err) {
      setError(noteErrorMessage(t, err));
    }
    setBusy(false);
  }

  const ask = (question: string, confirm: string, action: () => Promise<unknown>, done?: string) => (
    <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
      <Text style={{ color: colors.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 }}>{question}</Text>
      <View style={styles.wrap}>
        <Button variant="danger" label={confirm} loading={busy} onPress={() => void run(action, done)} />
        <Button variant="secondary" label={t('common.cancel')} onPress={() => setPanel('none')} disabled={busy} />
      </View>
    </View>
  );

  return (
    <View style={{ gap: space.xs }}>
      <Text accessibilityLabel={place ? `${name}, ${place} · ${meta}` : undefined} style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{name}</Text>
        {` · ${meta}`}
      </Text>

      {spoiler !== undefined ? (
        <SpoilerCover preview={entry.body ?? t('notes.deleted')} label={spoiler} place={place ?? ''} onReveal={onReveal} />
      ) : entry.body === null ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md, fontStyle: 'italic' }}>{t('notes.deleted')}</Text>
      ) : panel === 'edit' ? (
        <View style={{ gap: space.sm }}>
          <TextField label={t('notes.editLabel')} value={draft} onChangeText={setDraft} multiline maxLength={MAX_NOTE_LENGTH} autoFocus />
          <View style={styles.wrap}>
            <Button label={t('common.save')} loading={busy} disabled={!draft.trim()} onPress={() => void run(() => actions.edit(entry.id, draft.trim()))} />
            <Button variant="secondary" label={t('common.cancel')} onPress={() => setPanel('none')} disabled={busy} />
          </View>
        </View>
      ) : (
        <Text selectable style={{ fontFamily: fonts.reading, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, color: colors.text }}>
          {entry.body}
        </Text>
      )}

      {spoiler === undefined && entry.body !== null && panel !== 'edit' && (
        <View style={[styles.wrap, { alignItems: 'center' }]}>
          {entry.reactions.map((r) => (
            <Pressable
              key={r.emoji}
              accessibilityRole="button"
              accessibilityLabel={t(r.mine ? 'notes.reactionMine' : 'notes.reactionOthers', { emoji: r.emoji, count: r.count })}
              accessibilityState={{ selected: r.mine }}
              onPress={() => actions.react(entry.id, r.emoji).catch((err) => setError(noteErrorMessage(t, err)))}
              hitSlop={6}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: r.mine ? colors.accent : colors.control, backgroundColor: r.mine ? colors.background : 'transparent', opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={{ fontSize: fontSize.sm, color: colors.text }}>{`${r.emoji} ${r.count}`}</Text>
            </Pressable>
          ))}
          <TextButton tone="muted" label={t('notes.react')} onPress={() => toggle('react')} />
          {onReply && <TextButton tone="muted" label={t('notes.reply')} onPress={onReply} />}
          <TextButton tone="muted" label={t('notes.more')} accessibilityLabel={entry.mine ? t('notes.moreLabelMine') : t('notes.moreLabel', { name })} onPress={() => toggle('more')} />
        </View>
      )}

      {panel === 'react' && (
        <View style={styles.wrap} accessibilityLabel={t('notes.react')}>
          {REACTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              onPress={() => {
                setPanel('none');
                actions.react(entry.id, emoji).catch((err) => setError(noteErrorMessage(t, err)));
              }}
              style={({ pressed }) => [styles.emoji, { borderColor: colors.control, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={{ fontSize: fontSize.lg }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {panel === 'more' && (
        <View style={[styles.wrap, { columnGap: space.lg }]}>
          {entry.mine && <TextButton label={t('notes.edit')} onPress={() => setPanel('edit')} />}
          {(entry.mine || entry.canModerate) && (
            <TextButton tone="danger" label={entry.mine ? t('notes.delete') : t('notes.moderate')} onPress={() => setPanel('delete')} />
          )}
          {!entry.mine && <TextButton label={t('notes.report')} onPress={() => setPanel('report')} />}
          {!entry.mine && <TextButton label={t('notes.block', { name: entry.author.name })} onPress={() => setPanel('block')} />}
        </View>
      )}

      {panel === 'delete' &&
        ask(
          entry.mine ? t('notes.deleteQuestion') : t('notes.moderateQuestion'),
          entry.mine ? t('notes.deleteConfirm') : t('notes.moderateConfirm'),
          () => actions.remove(entry.id),
        )}

      {panel === 'report' && (
        <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
          <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{t('notes.reportQuestion')}</Text>
          <View style={styles.wrap}>
            {REPORT_REASONS.map((reason) => (
              <Button
                key={reason}
                variant="secondary"
                label={t(`notes.reason_${reason}`)}
                disabled={busy}
                onPress={() => void run(() => actions.report(entry.id, reason), t('notes.reported'))}
              />
            ))}
          </View>
          <View style={{ alignSelf: 'flex-start' }}>
            <TextButton tone="muted" label={t('common.cancel')} onPress={() => setPanel('none')} />
          </View>
        </View>
      )}

      {panel === 'block' &&
        ask(
          t('notes.blockQuestion', { name: entry.author.name }),
          t('notes.blockConfirm'),
          () => blocks.block(entry.author.id),
          t('notes.blocked', { name: entry.author.name }),
        )}

      {error && <Notice message={error} />}
    </View>
  );
}

/**
 * Covers a note past the viewer's place. On the web the text is blurred (the shape hints at its length);
 * elsewhere it is drawn as redaction bars. Either way it is hidden from screen readers until revealed.
 */
function SpoilerCover({ preview, label, place, onReveal }: { preview: string; label: string; place: string; onReveal?: () => void }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space } = useTheme();
  // Reading a note ahead of you is a decision, so it takes a deliberate "Show note", not any stray tap.
  return (
    <View style={{ borderRadius: radius.md, backgroundColor: colors.background, padding: space.md, gap: space.sm }}>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ overflow: 'hidden' }}>
        {Platform.OS === 'web' ? (
          <Text
            numberOfLines={3}
            style={{ fontFamily: fonts.reading, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, color: colors.text, filter: 'blur(6px)', userSelect: 'none' }}
          >
            {preview}
          </Text>
        ) : (
          <View style={{ gap: space.sm, paddingVertical: space.xs }}>
            {[100, 92, 58].slice(0, preview.length > 120 ? 3 : preview.length > 50 ? 2 : 1).map((w) => (
              <View key={w} style={{ height: 10, width: `${w}%`, borderRadius: 5, backgroundColor: colors.border }} />
            ))}
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md }}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{label}</Text>
        <TextButton label={t('notes.showNote')} accessibilityLabel={t('notes.revealLabel', { place, hint: label })} onPress={() => onReveal?.()} />
      </View>
    </View>
  );
}

function ReplyForm({ noteId, bookKey, onDone }: { noteId: string; bookKey: string; onDone: () => void }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const actions = useNoteActions(bookKey);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      await actions.reply(noteId, body.trim());
      onDone();
    } catch (err) {
      setError(noteErrorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <TextField label={t('notes.replyLabel')} value={body} onChangeText={setBody} multiline maxLength={MAX_NOTE_LENGTH} autoFocus />
      {error && <Notice message={error} />}
      <View style={styles.wrap}>
        <Button label={t('notes.sendReply')} loading={busy} disabled={!body.trim()} onPress={() => void send()} />
        <Button variant="secondary" label={t('common.cancel')} onPress={onDone} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 32, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, justifyContent: 'center' },
  emoji: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
