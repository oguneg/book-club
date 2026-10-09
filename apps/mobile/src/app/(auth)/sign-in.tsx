import { looksLikeEmail } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type TextInput } from 'react-native';
import { usePublicConfig } from '@/api/config';
import { appUrl, authClient } from '@/auth/client';
import { authErrorMessage, googleErrorMessage } from '@/auth/errors';
import { takeFlash } from '@/auth/flash';
import { FormLayout, OrDivider } from '@/components/FormLayout';
import { GoogleButton } from '@/components/GoogleButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';

export default function SignIn() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string; error?: string }>();
  const config = usePublicConfig();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [error, setError] = useState(params.error ? googleErrorMessage(t, params.error) : undefined);
  const [busy, setBusy] = useState(false);
  const [deleted] = useState(() => takeFlash() === 'accountDeleted');
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    setError(undefined);
    if (!looksLikeEmail(email)) {
      setEmailError(t('auth.validation.emailInvalid'));
      return;
    }
    setEmailError(undefined);
    setBusy(true);
    const result = await authClient.signIn.email({
      email: email.trim(),
      password,
      // Where the browser goes after signing in, and where a fresh confirmation link (sent when the
      // email still needs confirming) lands once used.
      callbackURL: appUrl('/'),
    });
    setBusy(false);
    if (result.error?.code === 'EMAIL_NOT_VERIFIED') {
      router.push({ pathname: '/check-email', params: { email: email.trim(), reason: 'unverified' } });
    } else if (result.error) {
      setError(authErrorMessage(t, result.error));
    }
    // On success the session changes and the root layout switches to the signed-in pages.
  }

  async function google() {
    setError(undefined);
    const result = await authClient.signIn.social({
      provider: 'google',
      callbackURL: appUrl('/'),
      errorCallbackURL: appUrl('/sign-in'),
    });
    if (result.error) setError(authErrorMessage(t, result.error));
  }

  return (
    <FormLayout title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')}>
      {deleted && <Notice tone="info" message={t('auth.signIn.accountDeleted')} />}
      {error && <Notice message={error} />}
      {config.data?.google && (
        <>
          <GoogleButton onPress={google} />
          <OrDivider />
        </>
      )}
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
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label={t('common.password')}
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label={t('auth.signIn.submit')} onPress={submit} loading={busy} disabled={!email || !password} />
      <View>
        <TextLink href={{ pathname: '/forgot-password', params: email ? { email } : {} }} label={t('auth.signIn.forgot')} />
        <TextLink href="/sign-up" label={`${t('auth.signIn.noAccount')} ${t('auth.signIn.createAccount')}`} />
      </View>
    </FormLayout>
  );
}
