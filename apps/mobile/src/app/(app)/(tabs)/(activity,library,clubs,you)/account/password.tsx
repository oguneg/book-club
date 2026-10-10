import { MIN_PASSWORD_LENGTH } from '@bookclub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, type TextInput } from 'react-native';
import { authClient } from '@/auth/client';
import { authErrorMessage } from '@/auth/errors';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';

export default function ChangePassword() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const nextRef = useRef<TextInput>(null);

  async function submit() {
    if (next.length < MIN_PASSWORD_LENGTH) {
      setErrors({ next: t('auth.validation.passwordTooShort', { min: MIN_PASSWORD_LENGTH }) });
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setBusy(false);
    if (result.error?.code === 'INVALID_PASSWORD') setErrors({ current: authErrorMessage(t, result.error) });
    else if (result.error) setErrors({ next: authErrorMessage(t, result.error) });
    else {
      setDone(true);
      setCurrent('');
      setNext('');
      await queryClient.invalidateQueries({ queryKey: ['account', 'devices'] });
    }
  }

  return (
    <Screen width="narrow">
      <PageTitle title={t('changePassword.title')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.xl, color: colors.text }}>
        {t('changePassword.title')}
      </Text>
      <View style={{ gap: space.lg, marginTop: space.xl }}>
        {done && <Notice tone="info" message={t('changePassword.done')} />}
        <TextField
          label={t('changePassword.current')}
          value={current}
          onChangeText={setCurrent}
          error={errors.current}
          password
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          onSubmitEditing={() => nextRef.current?.focus()}
        />
        <TextField
          ref={nextRef}
          label={t('changePassword.new')}
          hint={t('auth.signUp.passwordHint', { min: MIN_PASSWORD_LENGTH })}
          value={next}
          onChangeText={setNext}
          error={errors.next}
          password
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button label={t('changePassword.submit')} onPress={submit} loading={busy} disabled={!current || !next} />
      </View>
    </Screen>
  );
}
