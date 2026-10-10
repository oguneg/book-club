import type { ClubBook, Meeting } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { useClub, useClubActions, type MeetingInput } from '@/api/clubs';
import { clubErrorMessage } from '@/clubs/errors';
import { localDateTimeToIso, todayLocal, toLocalDateString, toLocalTimeString } from '@/clubs/format';
import { FormLayout } from '@/components/FormLayout';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { DateField } from '@/components/ui/DateField';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

// Plan a meeting (no meetingId) or edit one.
export default function MeetingForm() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id, meetingId } = useLocalSearchParams<{ id: string; meetingId?: string }>();
  const club = useClub(id);
  const book = club.data?.currentBook;
  const existing = meetingId ? book?.meetings.find((m) => m.id === meetingId) : undefined;

  if (!book || (meetingId && !existing)) {
    return (
      <FormLayout title={t(meetingId ? 'clubs.meeting.editTitle' : 'clubs.meeting.newTitle')}>
        {club.isPending ? <ActivityIndicator color={colors.accent} /> : <Notice message={t('clubs.errors.not_found')} />}
      </FormLayout>
    );
  }
  return <Form key={existing?.id ?? 'new'} clubId={id} book={book} existing={existing} />;
}

function Form({ clubId, book, existing }: { clubId: string; book: ClubBook; existing?: Meeting }) {
  const { t } = useTranslation();
  const actions = useClubActions(clubId);
  const starts = existing ? new Date(existing.startsAt) : null;
  const [date, setDate] = useState(starts ? toLocalDateString(starts) : todayLocal());
  const [time, setTime] = useState(starts ? toLocalTimeString(starts) : '18:00');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [readTo, setReadTo] = useState(existing?.readToPage ? String(existing.readToPage) : '');
  const [errors, setErrors] = useState<{ when?: string; title?: string; readTo?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const pages = book.edition.pageCount ?? 0;

  async function save() {
    const startsAt = localDateTimeToIso(date, time);
    const page = readTo ? Number(readTo) : null;
    const next: typeof errors = {};
    if (!startsAt) next.when = t('clubs.meeting.invalidDateTime');
    if (!title.trim()) next.title = t('clubs.meeting.titleRequired');
    if (page !== null && (!Number.isInteger(page) || page < 1 || page > pages)) next.readTo = t('clubs.meeting.pageInvalid', { max: pages });
    setErrors(next);
    if (Object.keys(next).length > 0 || !startsAt) return;

    const input: MeetingInput = { startsAt, title: title.trim(), location: location.trim() || null, readToPage: page };
    setBusy(true);
    try {
      if (existing) await actions.updateMeeting(existing.id, input);
      else await actions.addMeeting(input);
      router.back();
    } catch (err) {
      setErrors({ form: clubErrorMessage(t, err) });
      setBusy(false);
    }
  }

  return (
    <FormLayout title={t(existing ? 'clubs.meeting.editTitle' : 'clubs.meeting.newTitle')}>
      {errors.form && <Notice message={errors.form} />}
      <DateField label={t('clubs.meeting.date')} value={date} onChange={setDate} error={errors.when} />
      <DateField label={t('clubs.meeting.time')} kind="time" value={time} onChange={setTime} />
      <TextField label={t('clubs.meeting.name')} placeholder={t('clubs.meeting.namePlaceholder')} value={title} onChangeText={setTitle} error={errors.title} maxLength={120} />
      <TextField label={t('clubs.meeting.location')} value={location} onChangeText={setLocation} maxLength={300} />
      <TextField
        label={t('clubs.meeting.readTo')}
        hint={t('clubs.meeting.readToHint', { edition: book.edition.title, pages })}
        value={readTo}
        onChangeText={(v) => setReadTo(v.replace(/\D/g, ''))}
        error={errors.readTo}
        inputMode="numeric"
        maxLength={5}
      />
      <Button label={t('clubs.meeting.save')} onPress={save} loading={busy} />
      {existing && (
        <ConfirmButton
          label={t('clubs.meeting.delete')}
          question={t('clubs.meeting.deleteQuestion')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={async () => {
            await actions.deleteMeeting(existing.id);
            router.back();
          }}
        />
      )}
      <TextLink href={{ pathname: '/clubs/[id]', params: { id: clubId } }} label={t('common.cancel')} />
    </FormLayout>
  );
}
