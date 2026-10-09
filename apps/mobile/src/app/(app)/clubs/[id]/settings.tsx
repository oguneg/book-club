import { MAX_CLUB_DESCRIPTION, MAX_CLUB_NAME, roleAtLeast, type ClubDetail } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useClub, useClubActions } from '@/api/clubs';
import { clubErrorMessage } from '@/clubs/errors';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Notice } from '@/components/ui/Notice';
import { Hint, Section } from '@/components/ui/Section';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';

export default function ClubSettings() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const club = useClub(id);

  return (
    <Screen width="narrow">
      <PageTitle title={t('clubs.settings.title')} />
      <BackLink href={{ pathname: '/clubs/[id]', params: { id } }} label={club.data?.name ?? ''} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.xl, color: colors.text }}>
        {t('clubs.settings.title')}
      </Text>
      {club.isPending && <ActivityIndicator color={colors.accent} />}
      {club.isError && <Notice message={clubErrorMessage(t, club.error)} />}
      {club.data && (
        <View style={{ gap: space.lg, marginTop: space.xl }}>
          {roleAtLeast(club.data.myRole, 'admin') && <Details key={club.data.id} club={club.data} />}
          <LeaveOrDelete club={club.data} />
        </View>
      )}
    </Screen>
  );
}

function Details({ club }: { club: ClubDetail }) {
  const { t } = useTranslation();
  const actions = useClubActions(club.id);
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? '');
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' }>();
  const [busy, setBusy] = useState(false);
  const changed = name.trim() !== club.name || description.trim() !== (club.description ?? '');

  async function save() {
    setBusy(true);
    try {
      await actions.update({ name: name.trim(), description: description.trim() });
      setMessage({ text: t('common.saved'), tone: 'info' });
    } catch (err) {
      setMessage({ text: clubErrorMessage(t, err), tone: 'error' });
    }
    setBusy(false);
  }

  return (
    <Section title={t('clubs.settings.details')}>
      <TextField label={t('clubs.create.name')} value={name} onChangeText={setName} maxLength={MAX_CLUB_NAME} />
      <TextField label={t('clubs.create.description')} value={description} onChangeText={setDescription} maxLength={MAX_CLUB_DESCRIPTION} multiline numberOfLines={3} />
      {message && <Notice message={message.text} tone={message.tone} />}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button label={t('clubs.settings.save')} onPress={save} loading={busy} disabled={!changed || !name.trim()} />
      </View>
    </Section>
  );
}

function LeaveOrDelete({ club }: { club: ClubDetail }) {
  const { t } = useTranslation();
  const actions = useClubActions(club.id);
  const [error, setError] = useState<string>();

  const attempt = (action: () => Promise<unknown>) => async () => {
    try {
      await action();
      router.dismissTo('/');
    } catch (err) {
      setError(clubErrorMessage(t, err));
    }
  };

  return (
    <Section title={club.myRole === 'owner' ? t('clubs.settings.delete') : t('clubs.settings.leave')} tone="danger">
      {error && <Notice message={error} />}
      {club.myRole === 'owner' ? (
        <>
          <Hint>{t('clubs.settings.ownerLeaveHint')}</Hint>
          <ConfirmButton
            label={t('clubs.settings.delete')}
            question={t('clubs.settings.deleteQuestion', { name: club.name })}
            confirmLabel={t('clubs.settings.deleteConfirm')}
            danger
            onConfirm={attempt(actions.remove)}
          />
        </>
      ) : (
        <ConfirmButton
          label={t('clubs.settings.leave')}
          question={t('clubs.settings.leaveQuestion', { name: club.name })}
          confirmLabel={t('clubs.settings.leaveConfirm')}
          danger
          onConfirm={attempt(actions.leave)}
        />
      )}
    </Section>
  );
}
