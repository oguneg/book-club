import { normalizeInviteCode } from '@bookclub/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormLayout } from '@/components/FormLayout';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';

export default function JoinWithCode() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string>();

  function submit() {
    const code = normalizeInviteCode(input);
    if (!code) {
      setError(t('clubs.join.invalid'));
      return;
    }
    router.push({ pathname: '/join/[code]', params: { code } });
  }

  return (
    <FormLayout title={t('clubs.join.title')} subtitle={t('clubs.join.subtitle')}>
      <TextField
        label={t('clubs.join.code')}
        value={input}
        onChangeText={(v) => {
          setInput(v);
          setError(undefined);
        }}
        error={error}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label={t('clubs.join.submit')} onPress={submit} disabled={!input.trim()} />
      <TextLink href="/clubs" label={t('common.cancel')} />
    </FormLayout>
  );
}
