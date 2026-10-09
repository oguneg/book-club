import { MAX_CLUB_DESCRIPTION, MAX_CLUB_NAME } from '@bookclub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createClub } from '@/api/clubs';
import { clubErrorMessage } from '@/clubs/errors';
import { FormLayout } from '@/components/FormLayout';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';

export default function NewClub() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const club = await createClub({ name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) });
      queryClient.setQueryData(['club', club.id], club);
      await queryClient.invalidateQueries({ queryKey: ['clubs'] });
      router.replace({ pathname: '/clubs/[id]/setup', params: { id: club.id } });
    } catch (err) {
      setError(clubErrorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <FormLayout title={t('clubs.create.title')} subtitle={t('clubs.create.subtitle')}>
      {error && <Notice message={error} />}
      <TextField label={t('clubs.create.name')} value={name} onChangeText={setName} maxLength={MAX_CLUB_NAME} autoCapitalize="words" autoFocus />
      <TextField
        label={t('clubs.create.description')}
        hint={t('clubs.create.descriptionHint')}
        value={description}
        onChangeText={setDescription}
        maxLength={MAX_CLUB_DESCRIPTION}
        multiline
        numberOfLines={3}
      />
      <Button label={t('clubs.create.submit')} onPress={submit} loading={busy} disabled={!name.trim()} />
      <TextLink href="/" label={t('common.cancel')} />
    </FormLayout>
  );
}
