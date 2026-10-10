import type { ReadingDetail } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useReadingActions } from '@/api/readings';
import { formatDate } from '@/clubs/format';
import { localDay } from '@/readings/calendar';
import { readingErrorMessage } from '@/readings/errors';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { Sheet } from '@/components/ui/Sheet';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

/** A few days from today, or the last day of this month. */
function quickDates(today: Date) {
  const plus = (days: number) => localDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
  const monthEnd = localDay(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  return [
    { key: 'week', date: plus(7) },
    { key: 'twoWeeks', date: plus(14) },
    { key: 'month', date: localDay(new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())) },
    ...(monthEnd > plus(2) ? [{ key: 'monthEnd' as const, date: monthEnd }] : []),
  ] as const;
}

/**
 * "Finish by": a day to finish a book by. Setting one gives the book a pages-a-day target and a rabbit to
 * race; quick picks so nobody has to type a date on a phone.
 */
export function FinishBySheet({ reading, visible, onClose }: { reading: ReadingDetail; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const actions = useReadingActions(reading.id);
  const [today] = useState(() => new Date());
  const [date, setDate] = useState(reading.targetDate ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && date >= localDay(today);

  async function save(value: string | null) {
    setBusy(true);
    setError(undefined);
    try {
      await actions.setTargetDate(value);
      onClose();
    } catch (err) {
      setError(readingErrorMessage(t, err));
    }
    setBusy(false);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={t('finishBy.title')}>
      <View style={{ gap: space.lg, paddingBottom: space.sm }}>
        <Hint>{t('finishBy.body')}</Hint>
        {error && <Notice message={error} />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {quickDates(today).map((q) => (
            <View key={q.key} style={{ flexGrow: 1, flexBasis: '45%' }}>
              <Button
                variant="secondary"
                label={t(`finishBy.${q.key}`)}
                accessibilityLabel={`${t(`finishBy.${q.key}`)}, ${formatDate(q.date)}`}
                onPress={() => void save(q.date)}
                disabled={busy}
              />
            </View>
          ))}
        </View>
        <DateField label={t('finishBy.date')} value={date} onChange={setDate} error={date && !valid ? t('finishBy.invalid') : undefined} />
        <Button label={t('finishBy.save')} loading={busy} disabled={!valid} onPress={() => void save(date)} />
        {reading.targetDate && (
          <View style={{ alignItems: 'center' }}>
            <TextButton tone="danger" label={t('finishBy.remove')} onPress={() => void save(null)} disabled={busy} />
          </View>
        )}
      </View>
    </Sheet>
  );
}
