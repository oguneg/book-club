import { MAX_CLUB_DESCRIPTION, MAX_CLUB_NAME, roleAtLeast, type ClubDetail } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useClub, useClubActions } from '@/api/clubs';
import { clubErrorMessage } from '@/clubs/errors';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Notice } from '@/components/ui/Notice';
import { Hint, Section } from '@/components/ui/Section';
import { TextButton } from '@/components/ui/TextButton';
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
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.xl, color: colors.text }}>
        {t('clubs.settings.title')}
      </Text>
      {club.isPending && <ActivityIndicator color={colors.accent} />}
      {club.isError && <Notice message={clubErrorMessage(t, club.error)} />}
      {club.data && (
        <View style={{ gap: space.lg, marginTop: space.xl }}>
          {roleAtLeast(club.data.myRole, 'admin') && <BookTools club={club.data} />}
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
      router.dismissTo('/clubs');
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

/** The club's book and schedule, for owners and admins: choose or change the book, its dates, meetings, finish it. */
function BookTools({ club }: { club: ClubDetail }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const actions = useClubActions(club.id);
  const [error, setError] = useState<string>();
  const pick = () => router.push({ pathname: '/books', params: { pick: `club:${club.id}` } });
  return (
    <Section title={t('clubs.settings.book')}>
      {error && <Notice message={error} />}
      <View style={{ gap: space.xs, alignItems: 'flex-start' }}>
        <TextButton label={club.currentBook ? t('clubs.club.changeBook') : t('clubs.club.chooseBook')} onPress={pick} />
        {club.currentBook && (
          <>
            <TextButton label={t('clubs.club.changeDates')} onPress={() => router.push({ pathname: '/clubs/[id]/book', params: { id: club.id } })} />
            <TextButton label={t('clubs.club.planMeeting')} onPress={() => router.push({ pathname: '/clubs/[id]/meeting', params: { id: club.id } })} />
            <ConfirmButton
              quiet
              label={t('clubs.club.finish')}
              question={t('clubs.club.finishQuestion')}
              confirmLabel={t('clubs.club.finishConfirm')}
              onConfirm={() => actions.finishBook().catch((err) => setError(clubErrorMessage(t, err)))}
            />
          </>
        )}
        <ConfirmButton quiet label={t('clubs.club.newLink')} question={t('clubs.club.newLinkQuestion')} confirmLabel={t('clubs.club.newLinkConfirm')} onConfirm={() => actions.rotateInvite()} />
      </View>
    </Section>
  );
}
