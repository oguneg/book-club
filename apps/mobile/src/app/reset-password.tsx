import { MIN_PASSWORD_LENGTH } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authClient } from '@/auth/client';
import { authErrorMessage } from '@/auth/errors';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';

// Opened from the reset email: the server checks the link, then sends the browser here with ?token=
// (or ?error= when the link is expired or used).
export default function ResetPassword() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'invalid'>(params.token && !params.error ? 'form' : 'invalid');

  async function submit() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t('auth.validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    setPasswordError(undefined);
    setBusy(true);
    const result = await authClient.resetPassword({ newPassword: password, token: params.token ?? '' });
    setBusy(false);
    if (result.error?.code === 'INVALID_TOKEN') setState('invalid');
    else if (result.error) setPasswordError(authErrorMessage(t, result.error));
    else setState('done');
  }

  if (state === 'invalid') {
    return (
      <AuthLayout title={t('auth.reset.invalidTitle')} subtitle={t('auth.reset.invalidBody')}>
        <Button label={t('auth.reset.askAgain')} onPress={() => router.replace('/forgot-password')} />
      </AuthLayout>
    );
  }

  if (state === 'done') {
    return (
      <AuthLayout title={t('auth.reset.doneTitle')} subtitle={t('auth.reset.doneBody')}>
        <Button label={t('auth.signIn.submit')} onPress={() => router.replace('/sign-in')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.reset.title')}>
      <TextField
        label={t('auth.reset.newPassword')}
        hint={t('auth.signUp.passwordHint', { min: MIN_PASSWORD_LENGTH })}
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        password
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label={t('auth.reset.submit')} onPress={submit} loading={busy} disabled={!password} />
      <TextLink href="/sign-in" label={t('common.backToSignIn')} />
    </AuthLayout>
  );
}
