import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';

/** "Story starts on page … / ends on page …": the range progress is measured over in this copy. */
export function PageRangeFields({
  start,
  end,
  onStart,
  onEnd,
  error,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const digits = (v: string) => v.replace(/\D/g, '');
  return (
    <View style={{ gap: space.lg }}>
      <TextField label={t('reading.firstPage')} hint={t('reading.firstPageHint')} value={start} onChangeText={(v) => onStart(digits(v))} inputMode="numeric" maxLength={5} />
      <TextField label={t('reading.lastPage')} hint={t('reading.lastPageHint')} value={end} onChangeText={(v) => onEnd(digits(v))} error={error} inputMode="numeric" maxLength={5} />
    </View>
  );
}

/** The two fields as numbers, or null when the range is unusable. */
export function parsePageRange(start: string, end: string): { startPage: number; endPage: number } | null {
  const startPage = Number(start);
  const endPage = Number(end);
  if (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1 || endPage <= startPage) return null;
  return { startPage, endPage };
}
