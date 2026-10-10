import { MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH, looksLikeEmail } from '@bookclub/shared';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, type TextInput } from 'react-native';
import { usePublicConfig } from '@/api/config';
import { appUrl, authClient } from '@/auth/client';
import { authErrorMessage } from '@/auth/errors';
import { FormLayout, OrDivider } from '@/components/FormLayout';
import { AppleButton } from '@/components/AppleButton';
import { GoogleButton } from '@/components/GoogleButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { Hint } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export default function SignUp() {
  const { t } = useTranslation();
  const config = usePublicConfig();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    setError(undefined);
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = t('auth.validation.nameRequired');
    if (!looksLikeEmail(email)) errors.email = t('auth.validation.emailInvalid');
    if (password.length < MIN_PASSWORD_LENGTH) errors.password = t('auth.validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    const result = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL: appUrl('/email-confirmed'),
    });
    setBusy(false);
    if (result.error) {
      if (result.error.code === 'PASSWORD_COMPROMISED' || result.error.code?.startsWith('PASSWORD_TOO')) {
        setFieldErrors({ password: authErrorMessage(t, result.error) });
      } else {
        setError(authErrorMessage(t, result.error));
      }
      return;
    }
    // Same answer whether or not the address already had an account; its owner gets an email either way.
    router.replace({ pathname: '/check-email', params: { email: email.trim(), reason: 'signup' } });
  }

  // Sign in with Apple (iPhone): Apple's ID token, plus the name it shares on the very first sign-in only.
  async function apple(token: string, name: { firstName?: string; lastName?: string } | null) {
    setError(undefined);
    const result = await authClient.signIn.social({ provider: 'apple', idToken: { token, ...(name ? { user: { name } } : {}) } });
    if (result.error) setError(authErrorMessage(t, result.error));
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
    <FormLayout title={t('auth.signUp.title')} subtitle={t('auth.signUp.subtitle')}>
      {error && <Notice message={error} />}
      <AppleButton type="signUp" onSignIn={(token, name) => void apple(token, name)} onError={() => setError(t('auth.appleFailed'))} />
      {config.data?.google && <GoogleButton onPress={google} />}
      {(config.data?.google || Platform.OS === 'ios') && <OrDivider />}
      <TextField
        label={t('auth.signUp.name')}
        hint={t('auth.signUp.nameHint')}
        value={name}
        onChangeText={setName}
        error={fieldErrors.name}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label={t('common.email')}
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
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
        hint={t('auth.signUp.passwordHint', { min: MIN_PASSWORD_LENGTH })}
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        password
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label={t('auth.signUp.submit')} onPress={submit} loading={busy} />
      <Hint>{t('auth.signUp.agree')}</Hint>
      <TextLink href="/sign-in" label={`${t('auth.signUp.haveAccount')} ${t('auth.signUp.signIn')}`} />
    </FormLayout>
  );
}
