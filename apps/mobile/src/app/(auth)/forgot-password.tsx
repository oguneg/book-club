import { looksLikeEmail } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appUrl, authClient } from '@/auth/client';
import { authErrorMessage } from '@/auth/errors';
import { FormLayout } from '@/components/FormLayout';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [emailError, setEmailError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(undefined);
    if (!looksLikeEmail(email)) {
      setEmailError(t('auth.validation.emailInvalid'));
      return;
    }
    setEmailError(undefined);
    setBusy(true);
    const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: appUrl('/reset-password') });
    setBusy(false);
    if (result.error) {
      setError(authErrorMessage(t, result.error));
      return;
    }
    router.replace({ pathname: '/check-email', params: { email: email.trim(), reason: 'reset' } });
  }

  return (
    <FormLayout title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      {error && <Notice message={error} />}
      <TextField
        label={t('common.email')}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label={t('auth.forgot.submit')} onPress={submit} loading={busy} disabled={!email} />
      <TextLink href="/sign-in" label={t('common.backToSignIn')} />
    </FormLayout>
  );
}
