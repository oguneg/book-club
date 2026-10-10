import type { Reading } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useNotes } from '@/api/notes';
import { useReadingActions, useReadingStats, useWantToRead } from '@/api/readings';
import { bookErrorMessage } from '@/books/errors';
import { formatAuthors } from '@/books/format';
import { useStartReading } from '@/books/start';
import { readingErrorMessage } from '@/readings/errors';
import { BookCover } from '@/components/BookCover';
import { Confetti } from '@/components/Confetti';
import { Mascot } from '@/components/Mascot';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Sheet } from '@/components/ui/Sheet';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

/**
 * The end of a book, said quietly: every note on it is open now, there's room for a last thought, and the
 * next book you saved is one tap away. Finished by mistake? Undo.
 */
export function FinishedSheet({
  reading,
  visible,
  onClose,
  onLastThought,
  onReadNotes,
  before,
}: {
  reading: Pick<Reading, 'id' | 'bookKey'> & { edition: Pick<Reading['edition'], 'title'> };
  visible: boolean;
  onClose: () => void;
  onLastThought: () => void;
  onReadNotes: () => void;
  /** Where you were before finishing, for Undo; without it Undo only reopens the book. */
  before?: { page: number | null; position: number };
}) {
  const { t } = useTranslation();
  const { art, colors, fonts, fontSize, space } = useTheme();
  const notes = useNotes(reading.bookKey, 'all');
  const actions = useReadingActions(reading.id);
  const next = useWantToRead().data?.[0];
  const thisYear = useReadingStats().data?.finishedThisYear.length ?? 0;
  const start = useStartReading();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const others = (notes.data?.notes ?? []).filter((n) => !n.mine && n.body !== null).length;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('finished.title', { title: reading.edition.title })}>
      <View style={{ gap: space.lg, paddingBottom: space.sm }}>
        {/* Playful cheers (the other styles keep the ending quiet). */}
        {art && (
          <View>
            <Mascot pose="cheering" size={128} />
            <Confetti />
          </View>
        )}
        {error && <Notice message={error} />}
        <Text style={{ color: colors.text, fontFamily: fonts.reading, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6 }}>
          {[thisYear > 0 ? t('finished.countThisYear', { count: thisYear, ordinal: true }) : null, others > 0 ? t('finished.notesOpen', { count: others }) : t('finished.allOpen')]
            .filter(Boolean)
            .join(' ')}
        </Text>
        <View style={{ gap: space.sm }}>
          <Button label={t('finished.lastThought')} onPress={onLastThought} />
          {others > 0 && <Button variant="secondary" label={t('finished.readNotes')} onPress={onReadNotes} />}
        </View>

        {next && (
          <View style={{ gap: space.sm }}>
            <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
              {t('finished.nextUp')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <BookCover cover={next.edition.cover} title={next.edition.title} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.md, color: colors.text }}>
                  {next.edition.title}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                  {formatAuthors(next.edition.authors)}
                </Text>
              </View>
            </View>
            <Button
              variant="secondary"
              label={t('myBooks.start')}
              accessibilityLabel={t('myBooks.startLabel', { title: next.edition.title })}
              loading={busy}
              onPress={async () => {
                setBusy(true);
                setError(undefined);
                try {
                  onClose();
                  await start(next.edition);
                } catch (err) {
                  setError(bookErrorMessage(t, err));
                }
                setBusy(false);
              }}
            />
          </View>
        )}

        <View style={{ alignSelf: 'center' }}>
          <TextButton
            tone="muted"
            label={t('finished.undo')}
            onPress={async () => {
              try {
                await actions.resume();
                // Back to the page you were on, not the last one.
                if (before?.page != null) await actions.logPage(before.page);
                else if (before && before.position > 0) await actions.logPercent(before.position / 100);
                else if (before) await actions.logPage(0);
                onClose();
              } catch (err) {
                setError(readingErrorMessage(t, err));
              }
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}
