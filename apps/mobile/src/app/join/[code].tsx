import { normalizeInviteCode } from '@bookclub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { joinClub, useInvite } from '@/api/clubs';
import { authClient } from '@/auth/client';
import { formatAuthors } from '@/books/format';
import { clubErrorMessage } from '@/clubs/errors';
import { rememberInvite } from '@/clubs/pendingInvite';
import { BookCover } from '@/components/BookCover';
import { FormLayout } from '@/components/FormLayout';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { useTheme } from '@/theme';

// The page an invite link opens, signed in or not.
export default function Invite() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeInviteCode(params.code ?? '') ?? '';
  const { data: session } = authClient.useSession();
  const invite = useInvite(code);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!code || invite.isError) {
    return (
      <FormLayout title={t('clubs.invite.title')}>
        <Notice message={t('clubs.invite.invalid')} />
        <Button variant="secondary" label={t('notFound.back')} onPress={() => router.replace('/')} />
      </FormLayout>
    );
  }
  if (!invite.data) {
    return (
      <FormLayout title={t('clubs.invite.title')}>
        <ActivityIndicator color={colors.accent} />
      </FormLayout>
    );
  }

  const { club, isMember, isFull } = invite.data;

  async function join() {
    setBusy(true);
    setError(undefined);
    try {
      const { clubId } = await joinClub(code);
      await queryClient.invalidateQueries({ queryKey: ['clubs'] });
      router.replace({ pathname: '/clubs/[id]', params: { id: clubId } });
    } catch (err) {
      setError(clubErrorMessage(t, err));
      setBusy(false);
    }
  }

  function signInFirst(path: '/sign-in' | '/sign-up') {
    rememberInvite(code);
    router.push(path);
  }

  return (
    <FormLayout title={t('clubs.invite.title')}>
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        {club.currentBook && <BookCover cover={club.currentBook.cover} title={club.currentBook.title} size="md" />}
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, color: colors.text }}>{club.name}</Text>
          <Hint>{t('home.members', { count: club.memberCount })}</Hint>
          {club.currentBook && (
            <Hint>{`${t('clubs.invite.reading', { title: club.currentBook.title })} · ${formatAuthors(club.currentBook.authors)}`}</Hint>
          )}
        </View>
      </View>
      {club.description && <Text style={{ color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{club.description}</Text>}
      {error && <Notice message={error} />}

      {!session ? (
        <>
          <Hint>{t('clubs.invite.signInFirst')}</Hint>
          <Button label={t('auth.signIn.title')} onPress={() => signInFirst('/sign-in')} />
          <Button variant="secondary" label={t('auth.signIn.createAccount')} onPress={() => signInFirst('/sign-up')} />
        </>
      ) : isMember ? (
        <>
          <Hint>{t('clubs.invite.alreadyMember')}</Hint>
          <Button label={t('clubs.invite.open')} onPress={() => router.replace({ pathname: '/clubs/[id]', params: { id: club.id } })} />
        </>
      ) : isFull ? (
        <Notice message={t('clubs.invite.full')} />
      ) : (
        <Button label={t('clubs.invite.join', { name: club.name })} onPress={join} loading={busy} />
      )}
    </FormLayout>
  );
}
