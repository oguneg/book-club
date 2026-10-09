import { MoreHorizontal, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useReading, useReadingActions } from '@/api/readings';
import { formatAuthors } from '@/books/format';
import { formatDate } from '@/clubs/format';
import { readingErrorMessage } from '@/readings/errors';
import { readingLine } from '@/readings/format';
import { BookCover } from '@/components/BookCover';
import { BookLine } from '@/components/BookLine';
import { BookMenu } from '@/components/BookMenu';
import { NoteSheet } from '@/components/NoteSheet';
import { NotesFeed } from '@/components/Notes';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { UpdatePageSheet } from '@/components/UpdatePageSheet';
import { Button } from '@/components/ui/Button';
import { Fab } from '@/components/ui/Fab';
import { IconButton } from '@/components/ui/IconButton';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { useTheme } from '@/theme';

/**
 * One book you're reading, as a single screen: where you are, one button to update it, the notes along
 * the book and below it, and "+ Note". Everything else is in the ⋯ menu.
 */
export function ReadingView({ readingId, top }: { readingId: string; top?: ReactNode }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const query = useReading(readingId);
  const reading = query.data;
  const actions = useReadingActions(readingId);
  const [sheet, setSheet] = useState<'update' | 'note' | 'menu' | null>(null);
  const [message, setMessage] = useState<string>();
  const reading_ = reading?.status === 'reading';

  return (
    <Screen overlay={reading_ ? <Fab icon={Plus} label={t('notes.sheet.fab')} onPress={() => setSheet('note')} /> : undefined}>
      <PageTitle title={reading?.edition.title} />
      {top}
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={readingErrorMessage(t, query.error)} />}
      {reading && (
        <View style={{ gap: space.xl }}>
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' }}>
            <BookCover cover={reading.edition.cover} title={reading.edition.title} size="md" />
            <View style={{ flex: 1, gap: space.xs }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.2, color: colors.text }}>
                {reading.edition.title}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>{formatAuthors(reading.edition.authors)}</Text>
              <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: space.xs }}>{readingLine(t, reading)}</Text>
            </View>
            <IconButton icon={MoreHorizontal} label={t('reading.menu.label')} onPress={() => setSheet('menu')} />
          </View>

          <BookLine bookKey={reading.bookKey} scope="all" endPage={reading.endPage} />

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

          <NotesFeed bookKey={reading.bookKey} scope="all" title={t('notes.title')} />

          <UpdatePageSheet reading={reading} visible={sheet === 'update'} onClose={() => setSheet(null)} />
          <NoteSheet
            readingId={reading.id}
            bookKey={reading.bookKey}
            visible={sheet === 'note'}
            onClose={() => setSheet(null)}
            onPosted={() => setMessage(t('notes.added'))}
          />
          <BookMenu reading={reading} visible={sheet === 'menu'} onClose={() => setSheet(null)} />
        </View>
      )}
    </Screen>
  );
}
