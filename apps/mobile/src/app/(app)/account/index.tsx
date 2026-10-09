import { MAX_NAME_LENGTH } from '@bookclub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { downloadMyData, useDeviceCount, useSignInMethods } from '@/api/account';
import { usePublicConfig } from '@/api/config';
import { appUrl, authClient } from '@/auth/client';
import { authErrorMessage, googleErrorMessage } from '@/auth/errors';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { ServerStatus } from '@/components/ServerStatus';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Hint, Row, Section } from '@/components/ui/Section';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

type Message = { text: string; tone: 'error' | 'info' };

export default function Account() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const params = useLocalSearchParams<{ error?: string }>();
  const user = session?.user;

  return (
    <Screen>
      <PageTitle title={t('account.title')} />
      <BackLink href="/" label={t('appName')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text }}>
        {t('account.title')}
      </Text>
      {/* Connecting Google sends the browser to Google and back here, with ?error= if it failed. */}
      {params.error && (
        <View style={{ marginTop: space.lg }}>
          <Notice message={googleErrorMessage(t, params.error)} />
        </View>
      )}
      {user && (
        <View style={{ gap: space.lg, marginTop: space.xl }}>
          <ProfileSection name={user.name} email={user.email} />
          <SignInSection email={user.email} />
          <DevicesSection />
          <DataSection />
          <Section title={t('account.dangerTitle')} tone="danger">
            <Hint>{t('account.dangerBody')}</Hint>
            <TextLink href="/account/delete" label={t('account.deleteLink')} />
          </Section>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button variant="secondary" label={t('account.signOut')} onPress={() => void authClient.signOut()} />
          </View>
          <ServerStatus />
        </View>
      )}
    </Screen>
  );
}

function ProfileSection({ name: savedName, email }: { name: string; email: string }) {
  const { t } = useTranslation();
  const [name, setName] = useState(savedName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>();
  const changed = name.trim() !== savedName && name.trim().length > 0;

  async function save() {
    setBusy(true);
    const result = await authClient.updateUser({ name: name.trim() });
    setBusy(false);
    setMessage(result.error ? { text: authErrorMessage(t, result.error), tone: 'error' } : { text: t('common.saved'), tone: 'info' });
  }

  return (
    <Section title={t('account.profile')}>
      <TextField
        label={t('account.name')}
        hint={t('account.nameHint')}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setMessage(undefined);
        }}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="name"
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={() => changed && void save()}
      />
      {message && <Notice message={message.text} tone={message.tone} />}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button label={t('common.save')} onPress={save} loading={busy} disabled={!changed} />
      </View>
      <Row label={t('account.email')} value={email}>
        <Hint>{t('account.emailNote')}</Hint>
      </Row>
    </Section>
  );
}

function SignInSection({ email }: { email: string }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const queryClient = useQueryClient();
  const config = usePublicConfig();
  const methods = useSignInMethods();
  const [busy, setBusy] = useState<'password' | 'google'>();
  const [message, setMessage] = useState<Message>();

  const hasPassword = methods.data?.has('credential') ?? false;
  const googleAccountId = methods.data?.get('google');
  const hasGoogle = googleAccountId !== undefined;

  async function addPassword() {
    setBusy('password');
    const result = await authClient.requestPasswordReset({ email, redirectTo: appUrl('/reset-password') });
    setBusy(undefined);
    setMessage(result.error ? { text: authErrorMessage(t, result.error), tone: 'error' } : { text: t('account.addPasswordSent', { email }), tone: 'info' });
  }

  async function connectGoogle() {
    setBusy('google');
    const result = await authClient.linkSocial({ provider: 'google', callbackURL: appUrl('/account'), errorCallbackURL: appUrl('/account') });
    if (result.error) {
      setBusy(undefined);
      setMessage({ text: authErrorMessage(t, result.error), tone: 'error' });
    }
    // On success the browser is on its way to Google.
  }

  async function disconnectGoogle() {
    setBusy('google');
    if (!googleAccountId) return;
    const result = await authClient.unlinkAccount({ accountId: googleAccountId });
    setBusy(undefined);
    await queryClient.invalidateQueries({ queryKey: ['account', 'methods'] });
    setMessage(result.error ? { text: authErrorMessage(t, result.error), tone: 'error' } : { text: t('account.googleDisconnected'), tone: 'info' });
  }

  if (!methods.data) return <Section title={t('account.methods')}>{null}</Section>;

  return (
    <Section title={t('account.methods')}>
      {message && <Notice message={message.text} tone={message.tone} />}
      <Row label={t('account.password')} value={hasPassword ? t('account.passwordSet') : undefined}>
        {hasPassword ? (
          <TextLink href="/account/password" label={t('account.changePassword')} />
        ) : (
          <View style={{ gap: space.sm, alignItems: 'flex-start' }}>
            <Hint>{t('account.passwordNotSet')}</Hint>
            <Button variant="secondary" label={t('account.addPassword')} onPress={addPassword} loading={busy === 'password'} />
          </View>
        )}
      </Row>
      {(config.data?.google || hasGoogle) && (
        <Row label={t('account.google')} value={hasGoogle ? t('account.googleConnected') : t('account.googleNotConnected')}>
          <View style={{ gap: space.sm, alignItems: 'flex-start' }}>
            {hasGoogle && hasPassword && (
              <Button variant="secondary" label={t('account.disconnectGoogle')} onPress={disconnectGoogle} loading={busy === 'google'} />
            )}
            {hasGoogle && !hasPassword && <Hint>{t('account.disconnectNeedsPassword')}</Hint>}
            {!hasGoogle && config.data?.google && (
              <Button variant="secondary" label={t('account.connectGoogle')} onPress={connectGoogle} loading={busy === 'google'} />
            )}
          </View>
        </Row>
      )}
    </Section>
  );
}

function DevicesSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const devices = useDeviceCount();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>();

  async function signOutOthers() {
    setBusy(true);
    const result = await authClient.revokeOtherSessions();
    setBusy(false);
    await queryClient.invalidateQueries({ queryKey: ['account', 'devices'] });
    setMessage(result.error ? { text: authErrorMessage(t, result.error), tone: 'error' } : { text: t('account.othersSignedOut'), tone: 'info' });
  }

  return (
    <Section title={t('account.devices')}>
      {devices.data !== undefined && <Hint>{t('account.devicesCount', { count: devices.data })}</Hint>}
      {message && <Notice message={message.text} tone={message.tone} />}
      {(devices.data ?? 0) > 1 && (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button variant="secondary" label={t('account.signOutOthers')} onPress={signOutOthers} loading={busy} />
        </View>
      )}
    </Section>
  );
}

function DataSection() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function download() {
    setBusy(true);
    setError(undefined);
    try {
      await downloadMyData();
    } catch {
      setError(t('auth.errors.generic'));
    }
    setBusy(false);
  }

  return (
    <Section title={t('account.data')}>
      <Hint>{t('account.dataBody')}</Hint>
      {error && <Notice message={error} />}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button variant="secondary" label={t('account.download')} onPress={download} loading={busy} />
      </View>
    </Section>
  );
}
