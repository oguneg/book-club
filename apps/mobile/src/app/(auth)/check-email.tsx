import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { appUrl, authClient } from '@/auth/client';
import { authErrorMessage } from '@/auth/errors';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

const RESEND_COOLDOWN_SECONDS = 60;

type Reason = 'signup' | 'unverified' | 'reset';

export default function CheckEmail() {
  const { t } = useTranslation();
  const { colors, fontSize } = useTheme();
  const params = useLocalSearchParams<{ email?: string; reason?: Reason }>();
  const email = params.email ?? '';
  const reason: Reason = params.reason === 'reset' || params.reason === 'unverified' ? params.reason : 'signup';
  const canResend = reason !== 'reset' && Boolean(email);

  // A link was just sent, so the first resend waits a minute too.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'info' }>();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    setBusy(true);
    const result = await authClient.sendVerificationEmail({ email, callbackURL: appUrl('/email-confirmed') });
    setBusy(false);
    setNotice(result.error ? { message: authErrorMessage(t, result.error), tone: 'error' } : { message: t('auth.checkEmail.resent'), tone: 'info' });
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <AuthLayout title={t('auth.checkEmail.title')} subtitle={t(`auth.checkEmail.${reason}`, { email })}>
      {notice && <Notice message={notice.message} tone={notice.tone} />}
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{t('auth.checkEmail.spam')}</Text>
      {canResend && (
        <Button
          variant="secondary"
          label={cooldown > 0 ? t('auth.checkEmail.resendIn', { seconds: cooldown }) : t('auth.checkEmail.resend')}
          onPress={resend}
          loading={busy}
          disabled={cooldown > 0}
        />
      )}
      <TextLink href={{ pathname: '/sign-in', params: email ? { email } : {} }} label={t('common.backToSignIn')} />
    </AuthLayout>
  );
}
