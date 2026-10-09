import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ReadingView } from '@/components/ReadingView';
import { BackButton } from '@/components/ui/BackButton';

/** A book you're reading (or read), opened from a club, your shelf or a link: the same screen as the Reading tab. */
export default function ReadingPage() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReadingView readingId={id} top={<BackButton label={t('common.back')} fallback="/" />} />;
}
