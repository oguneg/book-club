import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { useClub, useClubActions } from '@/api/clubs';
import { clubErrorMessage } from '@/clubs/errors';
import { FormLayout } from '@/components/FormLayout';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Notice } from '@/components/ui/Notice';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

export default function BookDates() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const club = useClub(id);
  const book = club.data?.currentBook;

  if (!book) {
    return (
      <FormLayout title={t('clubs.book.title')}>
        {club.isPending ? <ActivityIndicator color={colors.accent} /> : <Notice message={t('clubs.errors.no_current_book')} />}
      </FormLayout>
    );
  }
  // Keyed by book so the form starts from the saved dates.
  return <DatesForm key={book.id} clubId={id} startDate={book.startDate} finishDate={book.finishDate ?? ''} />;
}

function DatesForm({ clubId, startDate: savedStart, finishDate: savedFinish }: { clubId: string; startDate: string; finishDate: string }) {
  const { t } = useTranslation();
  const actions = useClubActions(clubId);
  const [startDate, setStartDate] = useState(savedStart);
  const [finishDate, setFinishDate] = useState(savedFinish);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await actions.updateBook({ startDate, finishDate: finishDate || null });
      router.back();
    } catch (err) {
      setError(clubErrorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <FormLayout title={t('clubs.book.title')}>
      {error && <Notice message={error} />}
      <DateField label={t('clubs.book.start')} value={startDate} onChange={setStartDate} />
      <DateField label={t('clubs.book.finish')} hint={t('clubs.book.finishHint')} value={finishDate} onChange={setFinishDate} />
      {finishDate ? <Button variant="secondary" label={t('clubs.book.clearFinish')} onPress={() => setFinishDate('')} /> : null}
      <Button label={t('clubs.book.save')} onPress={save} loading={busy} disabled={!startDate} />
      <TextLink href={{ pathname: '/clubs/[id]', params: { id: clubId } }} label={t('common.cancel')} />
    </FormLayout>
  );
}
