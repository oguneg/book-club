import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FormLayout } from '@/components/FormLayout';
import { Button } from '@/components/ui/Button';

// The confirmation link in the sign-up email lands here, already signed in (or with ?error= when the
// link is expired or used).
export default function EmailConfirmed() {
  const { t } = useTranslation();
  const { error } = useLocalSearchParams<{ error?: string }>();

  if (error) {
    return (
      <FormLayout title={t('auth.confirmed.invalidTitle')} subtitle={t('auth.confirmed.invalidBody')}>
        <Button label={t('auth.signIn.submit')} onPress={() => router.replace('/sign-in')} />
      </FormLayout>
    );
  }

  return (
    <FormLayout title={t('auth.confirmed.title')} subtitle={t('auth.confirmed.body')}>
      <Button label={t('common.continue')} onPress={() => router.replace('/')} />
    </FormLayout>
  );
}
