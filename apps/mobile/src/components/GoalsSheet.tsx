import { MAX_DAILY_PAGES, MAX_YEARLY_BOOKS } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useReadingGoals, useSetReadingGoals } from '@/api/goals';
import { readingErrorMessage } from '@/readings/errors';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';

/** A whole number in range, null for empty, undefined for anything else. */
function parseGoal(value: string, max: number): number | null | undefined {
  const text = value.trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined;
}

/** Your goals, both optional: books to finish this year, pages a day. Empty means no goal. */
export function GoalsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const goals = useReadingGoals().data;
  const setGoals = useSetReadingGoals();
  const toast = useToast();
  const year = new Date().getFullYear();
  const [yearly, setYearly] = useState<string>();
  const [daily, setDaily] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // What's typed, or the saved goal until something is.
  const yearlyText = yearly ?? (goals?.yearlyBooks ? String(goals.yearlyBooks) : '');
  const dailyText = daily ?? (goals?.dailyPages ? String(goals.dailyPages) : '');
  const yearlyValue = parseGoal(yearlyText, MAX_YEARLY_BOOKS);
  const dailyValue = parseGoal(dailyText, MAX_DAILY_PAGES);

  const close = () => {
    setYearly(undefined);
    setDaily(undefined);
    setError(undefined);
    onClose();
  };

  async function save() {
    if (yearlyValue === undefined || dailyValue === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      await setGoals({ yearlyBooks: yearlyValue, dailyPages: dailyValue });
      toast(t('goals.saved'));
      close();
    } catch (err) {
      setError(readingErrorMessage(t, err));
    }
    setBusy(false);
  }

  return (
    <Sheet visible={visible} onClose={close} title={t('goals.sheetTitle')}>
      <View style={{ gap: space.lg, paddingBottom: space.sm }}>
        <Hint>{t('goals.sheetBody')}</Hint>
        {error && <Notice message={error} />}
        <TextField
          label={t('goals.yearly', { year })}
          value={yearlyText}
          onChangeText={setYearly}
          inputMode="numeric"
          maxLength={3}
          placeholder={t('goals.none')}
          error={yearlyValue === undefined ? t('goals.invalid', { max: MAX_YEARLY_BOOKS }) : undefined}
        />
        <TextField
          label={t('goals.daily')}
          value={dailyText}
          onChangeText={setDaily}
          inputMode="numeric"
          maxLength={4}
          placeholder={t('goals.none')}
          error={dailyValue === undefined ? t('goals.invalid', { max: MAX_DAILY_PAGES }) : undefined}
        />
        <Button label={t('goals.save')} loading={busy} disabled={yearlyValue === undefined || dailyValue === undefined} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}
