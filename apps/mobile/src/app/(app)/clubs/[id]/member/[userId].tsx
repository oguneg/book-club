import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useClub, useClubActions } from '@/api/clubs';
import { authClient } from '@/auth/client';
import { clubErrorMessage } from '@/clubs/errors';
import { formatDate } from '@/clubs/format';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { useTheme } from '@/theme';

export default function MemberPage() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { id, userId } = useLocalSearchParams<{ id: string; userId: string }>();
  const { data: session } = authClient.useSession();
  const club = useClub(id);
  const actions = useClubActions(id);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const member = club.data?.members.find((m) => m.userId === userId);
  const myRole = club.data?.myRole;
  const isSelf = session?.user.id === userId;

  async function run(action: () => Promise<unknown>, thenLeave = false) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      if (thenLeave) router.back();
    } catch (err) {
      setError(clubErrorMessage(t, err));
    }
    setBusy(false);
  }

  // What the viewer may do to this member (the server enforces the same rules).
  const canChangeRole = myRole === 'owner' && !isSelf && member?.role !== 'owner';
  const canRemove = !isSelf && member?.role !== 'owner' && (myRole === 'owner' || (myRole === 'admin' && member?.role === 'member'));

  return (
    <Screen width="narrow">
      <PageTitle title={member?.name} />
      <BackLink href={{ pathname: '/clubs/[id]', params: { id } }} label={club.data?.name ?? ''} />
      {club.isPending && <ActivityIndicator color={colors.accent} />}
      {(club.isError || (club.data && !member)) && <Notice message={t('clubs.errors.not_found')} />}
      {member && (
        <View style={{ gap: space.lg }}>
          <View style={{ gap: space.xs }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.xl, color: colors.text }}>
              {member.name}
              {isSelf ? ` (${t('clubs.club.you')})` : ''}
            </Text>
            <Hint>{`${t(`clubs.roles.${member.role}`)} · ${t('clubs.member.joined', { date: formatDate(member.joinedAt.slice(0, 10)) })}`}</Hint>
          </View>
          {error && <Notice message={error} />}
          {canChangeRole && (
            <View style={{ gap: space.sm }}>
              <Hint>{t('clubs.member.adminHint')}</Hint>
              <View style={{ alignSelf: 'flex-start' }}>
                <Button
                  variant="secondary"
                  loading={busy}
                  label={member.role === 'admin' ? t('clubs.member.removeAdmin') : t('clubs.member.makeAdmin')}
                  onPress={() => run(() => actions.setRole(member.userId, member.role === 'admin' ? 'member' : 'admin'))}
                />
              </View>
              <ConfirmButton
                label={t('clubs.member.makeOwner')}
                question={t('clubs.member.makeOwnerQuestion', { name: member.name })}
                confirmLabel={t('clubs.member.makeOwnerConfirm')}
                onConfirm={() => run(() => actions.transfer(member.userId))}
              />
            </View>
          )}
          {canRemove && (
            <ConfirmButton
              label={t('clubs.member.remove')}
              question={t('clubs.member.removeQuestion', { name: member.name })}
              confirmLabel={t('clubs.member.removeConfirm')}
              danger
              onConfirm={() => run(() => actions.removeMember(member.userId), true)}
            />
          )}
          {!canChangeRole && !canRemove && <Hint>{t('clubs.member.noActions')}</Hint>}
        </View>
      )}
    </Screen>
  );
}
