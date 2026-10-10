import type { ReadingDetail } from '@bookclub/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useReadingActions } from '@/api/readings';
import { formatDate, formatMeetingTime } from '@/clubs/format';
import { readingErrorMessage } from '@/readings/errors';
import { readingLine } from '@/readings/format';
import { PageRangeFields, parsePageRange } from '@/components/PageRangeFields';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { Sheet } from '@/components/ui/Sheet';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

/** Everything you rarely need for a book, in one place: finished, stop, your copy's pages, history, remove. */
export function BookMenu({
  reading,
  visible,
  onClose,
  onFinished,
  onFinishBy,
}: {
  reading: ReadingDetail;
  visible: boolean;
  onClose: () => void;
  /** After "I finished it": the page around shows the ending, whose Undo goes back to `before`. */
  onFinished: (before: { page: number | null; position: number }) => void;
  /** "Finish by a date": the page around opens its sheet. */
  onFinishBy?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const actions = useReadingActions(reading.id);
  const [error, setError] = useState<string>();
  const [editingPages, setEditingPages] = useState(false);
  const [start, setStart] = useState(String(reading.startPage));
  const [end, setEnd] = useState(String(reading.endPage));
  const attempt = (action: () => Promise<unknown>) => async () => {
    setError(undefined);
    try {
      await action();
      onClose();
    } catch (err) {
      setError(readingErrorMessage(t, err));
    }
  };
  const history = [...reading.history].reverse().slice(0, 8);
  const heading = { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' as const };

  return (
    <Sheet visible={visible} onClose={onClose} title={reading.edition.title}>
      <View style={{ gap: space.lg, paddingBottom: space.sm }}>
        {error && <Notice message={error} />}
        <View style={{ gap: space.xs, alignItems: 'flex-start' }}>
          {reading.status === 'reading' ? (
            <>
              {/* Good news needs no confirming: the ending sheet that follows has an Undo. */}
              <TextButton
                label={t('reading.finishIt')}
                onPress={async () => {
                  setError(undefined);
                  const before = { page: reading.currentPage, position: reading.position };
                  try {
                    await actions.finish();
                    onClose();
                    onFinished(before);
                  } catch (err) {
                    setError(readingErrorMessage(t, err));
                  }
                }}
              />
              {onFinishBy && (
                <TextButton
                  label={reading.targetDate ? t('finishBy.menuSet', { date: formatDate(reading.targetDate) }) : t('finishBy.menu')}
                  onPress={onFinishBy}
                />
              )}
              <ConfirmButton quiet label={t('reading.stop')} question={t('reading.stopQuestion')} confirmLabel={t('reading.stopConfirm')} onConfirm={attempt(actions.stop)} />
            </>
          ) : (
            <Button variant="secondary" label={t('reading.resume')} onPress={() => void attempt(actions.resume)()} />
          )}
        </View>

        <View style={{ gap: space.xs }}>
          <Text style={heading}>{t('reading.pages')}</Text>
          {editingPages ? (
            <View style={{ gap: space.md }}>
              <PageRangeFields start={start} end={end} onStart={setStart} onEnd={setEnd} />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button
                  label={t('reading.savePages')}
                  onPress={async () => {
                    const range = parsePageRange(start, end);
                    if (!range) return setError(t('reading.rangeInvalid'));
                    await attempt(() => actions.setRange(range.startPage, range.endPage))();
                    setEditingPages(false);
                  }}
                />
                <Button variant="secondary" label={t('common.cancel')} onPress={() => setEditingPages(false)} />
              </View>
            </View>
          ) : (
            <>
              <Hint>{t('reading.pagesLine', { start: reading.startPage, end: reading.endPage })}</Hint>
              <View style={{ flexDirection: 'row', columnGap: space.lg, flexWrap: 'wrap' }}>
                <TextButton label={t('reading.changePages')} onPress={() => setEditingPages(true)} />
                {reading.edition.workKey && (
                  <TextButton
                    label={t('reading.menu.otherEdition')}
                    onPress={() => {
                      onClose();
                      router.push({ pathname: '/books/work/[key]', params: { key: reading.edition.workKey! } });
                    }}
                  />
                )}
              </View>
            </>
          )}
        </View>

        <View style={{ gap: space.xs }}>
          <Text style={heading}>{t('reading.history')}</Text>
          {history.length === 0 && <Hint>{t('reading.noHistory')}</Hint>}
          {history.map((h) => (
            <View key={h.at} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{formatMeetingTime(h.at)}</Text>
              <Text style={{ color: colors.text, fontSize: fontSize.sm, fontVariant: ['tabular-nums'] }}>
                {readingLine(t, { status: 'reading', position: h.position, currentPage: h.page, endPage: reading.endPage })}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ alignItems: 'flex-start' }}>
          <ConfirmButton
            quiet
            danger
            label={t('reading.remove')}
            question={t('reading.removeQuestion')}
            confirmLabel={t('reading.removeConfirm')}
            onConfirm={async () => {
              await actions.remove();
              onClose();
              router.dismissTo('/library');
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}
