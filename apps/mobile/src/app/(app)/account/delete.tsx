import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSignInMethods } from '@/api/account';
import { authClient } from '@/auth/client';
import { authErrorMessage } from '@/auth/errors';
import { clearFlash, setFlash } from '@/auth/flash';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';

export default function DeleteAccount() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const methods = useSignInMethods();
  const hasPassword = methods.data?.has('credential') ?? false;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [needsReauth, setNeedsReauth] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setError(undefined);
    setBusy(true);
    setFlash('accountDeleted');
    const result = await authClient.deleteUser(hasPassword ? { password } : {});
    setBusy(false);
    if (!result.error) return; // The session is gone; the app switches to the sign-in page and shows the flash.
    clearFlash();
    if (result.error.code === 'SESSION_EXPIRED') setNeedsReauth(true);
    else setError(authErrorMessage(t, result.error));
  }

  if (needsReauth) {
    return (
      <Screen width="narrow">
        <PageTitle title={t('deleteAccount.reauthTitle')} />
        <BackLink href="/account" label={t('account.title')} />
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.xl, color: colors.text }}>
          {t('deleteAccount.reauthTitle')}
        </Text>
        <View style={{ gap: space.lg, marginTop: space.lg }}>
          <Hint>{t('deleteAccount.reauthBody')}</Hint>
          <Button label={t('deleteAccount.reauthAction')} onPress={() => void authClient.signOut()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen width="narrow">
      <PageTitle title={t('deleteAccount.title')} />
      <BackLink href="/account" label={t('account.title')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.xl, color: colors.danger }}>
        {t('deleteAccount.title')}
      </Text>
      <View style={{ gap: space.lg, marginTop: space.lg }}>
        <Text style={{ color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{t('deleteAccount.body')}</Text>
        {error && <Notice message={error} />}
        {methods.data &&
          (hasPassword ? (
            <TextField
              label={t('deleteAccount.passwordLabel')}
              value={password}
              onChangeText={setPassword}
              password
              autoComplete="current-password"
              textContentType="password"
            />
          ) : (
            <Hint>{t('deleteAccount.googleNote')}</Hint>
          ))}
        <Button
          variant="danger"
          label={t('deleteAccount.submit')}
          onPress={remove}
          loading={busy}
          disabled={!methods.data || (hasPassword && !password)}
        />
        <Button variant="secondary" label={t('deleteAccount.cancel')} onPress={() => router.replace('/account')} />
      </View>
    </Screen>
  );
}
