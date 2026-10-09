import { router, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { useClub, useClubActions } from '@/api/clubs';
import { clubErrorMessage } from '@/clubs/errors';
import { FormLayout } from '@/components/FormLayout';
import { InviteBody } from '@/components/Invite';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { TextButton } from '@/components/ui/TextButton';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';

type Step = 'book' | 'finish' | 'invite';
const STEPS: Step[] = ['book', 'finish', 'invite'];

/**
 * A new club in three short steps: the book, when to finish it, and who to invite. Each one can wait
 * ("Skip"), and the club page has them all later; this just puts them in a sensible order.
 */
export default function ClubSetup() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const club = useClub(id);
  // The book step is done once the club has a book; the rest move on by tapping Next or Skip.
  const [moved, setMoved] = useState<Step | null>(null);
  const data = club.data;

  if (!data) {
    return (
      <FormLayout title={t('clubs.setup.title')}>
        {club.isPending ? <ActivityIndicator color={colors.accent} /> : <Notice message={clubErrorMessage(t, club.error)} />}
      </FormLayout>
    );
  }
  const step: Step = moved ?? (data.currentBook ? 'finish' : 'book');
  const done = () => router.replace({ pathname: '/clubs/[id]', params: { id } });

  if (step === 'book') {
    return (
      <FormLayout title={t('clubs.setup.bookTitle')} subtitle={t('clubs.setup.bookBody')}>
        <Steps step={step} />
        <BookStep clubId={id} onSkip={() => setMoved('invite')} />
      </FormLayout>
    );
  }
  if (step === 'finish' && data.currentBook) {
    return (
      <FormLayout title={t('clubs.setup.finishTitle')} subtitle={t('clubs.setup.finishBody', { title: data.currentBook.edition.title })}>
        <Steps step={step} />
        <FinishStep clubId={id} onNext={() => setMoved('invite')} />
      </FormLayout>
    );
  }
  return (
    <FormLayout title={t('clubs.setup.inviteTitle', { club: data.name })}>
      <Steps step="invite" />
      <InviteBody club={data} />
      <Button variant="secondary" label={t('clubs.setup.done')} onPress={done} />
    </FormLayout>
  );
}

/** Three short bars: where you are in the setup. */
function Steps({ step }: { step: Step }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const at = STEPS.indexOf(step);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('clubs.setup.progress', { step: at + 1, count: STEPS.length })}
      accessibilityValue={{ min: 1, max: STEPS.length, now: at + 1 }}
      style={{ flexDirection: 'row', gap: space.xs }}
    >
      {STEPS.map((s, i) => (
        <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= at ? colors.accent : colors.border }} />
      ))}
    </View>
  );
}

function BookStep({ clubId, onSkip }: { clubId: string; onSkip: () => void }) {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const [q, setQ] = useState('');
  const find = () => router.push({ pathname: '/books', params: { pick: `club:${clubId}:setup`, ...(q.trim() ? { q: q.trim() } : {}) } });
  return (
    <View style={{ gap: space.lg }}>
      <TextField label={t('books.searchLabel')} value={q} onChangeText={setQ} inputMode="search" returnKeyType="search" onSubmitEditing={find} autoCorrect={false} />
      <Button label={t('clubs.setup.findBook')} icon={<Search size={18} color={colors.onAccent} />} onPress={find} />
      <View style={{ alignSelf: 'center' }}>
        <TextButton tone="muted" label={t('clubs.setup.skip')} onPress={onSkip} />
      </View>
    </View>
  );
}

function FinishStep({ clubId, onNext }: { clubId: string; onNext: () => void }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const actions = useClubActions(clubId);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function next() {
    setBusy(true);
    setError(undefined);
    try {
      await actions.updateBook({ finishDate: date });
      onNext();
    } catch (err) {
      setError(clubErrorMessage(t, err));
    }
    setBusy(false);
  }

  return (
    <View style={{ gap: space.lg }}>
      {error && <Notice message={error} />}
      <DateField label={t('clubs.book.finish')} value={date} onChange={setDate} />
      <Hint>{t('clubs.setup.finishHint')}</Hint>
      <Button label={t('clubs.setup.next')} onPress={() => void next()} loading={busy} disabled={!date} />
      <View style={{ alignSelf: 'center' }}>
        <TextButton tone="muted" label={t('clubs.setup.skip')} onPress={onNext} />
      </View>
    </View>
  );
}
