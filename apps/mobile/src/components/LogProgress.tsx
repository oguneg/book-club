import type { ReadingDetail } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useReadingActions } from '@/api/readings';
import { readingErrorMessage } from '@/readings/errors';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';

/** "Where are you?": a page in this copy, or a percentage for e-readers. One tap to save. */
export function LogProgress({ reading }: { reading: ReadingDetail }) {
  const { t } = useTranslation();
  const { colors, fontSize, radius, space, minTouch } = useTheme();
  const actions = useReadingActions(reading.id);
  // E-book readers who logged a percentage last time probably want the percentage again.
  const lastWasPercent = reading.history.length > 0 && reading.history[reading.history.length - 1]?.page === null;
  const [mode, setMode] = useState<'page' | 'percent'>(lastWasPercent ? 'percent' : 'page');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' }>();
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = Number(value.replace(',', '.'));
    if (mode === 'page' && (!Number.isInteger(n) || n < 0 || n > reading.endPage)) {
      setMessage({ text: t('reading.pageInvalid', { max: reading.endPage }), tone: 'error' });
      return;
    }
    if (mode === 'percent' && (Number.isNaN(n) || n < 0 || n > 100)) {
      setMessage({ text: t('reading.percentInvalid'), tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await (mode === 'page' ? actions.logPage(n) : actions.logPercent(n));
      setValue('');
      setMessage({ text: t('reading.saved'), tone: 'info' });
    } catch (err) {
      setMessage({ text: readingErrorMessage(t, err), tone: 'error' });
    }
    setBusy(false);
  }

  const tab = (key: 'page' | 'percent', label: string) => (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: mode === key }}
      onPress={() => {
        setMode(key);
        setMessage(undefined);
      }}
      style={{
        minHeight: minTouch - 8,
        paddingHorizontal: space.md,
        justifyContent: 'center',
        borderRadius: radius.sm,
        backgroundColor: mode === key ? colors.surface : 'transparent',
        borderWidth: 1,
        borderColor: mode === key ? colors.control : 'transparent',
      }}
    >
      <Text style={{ color: mode === key ? colors.text : colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: space.md }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space.xs }}>
        {tab('page', t('reading.page'))}
        {tab('percent', t('reading.percent'))}
      </View>
      <TextField
        label={mode === 'page' ? t('reading.logPage') : t('reading.logPercent')}
        value={value}
        onChangeText={(v) => {
          setValue(mode === 'page' ? v.replace(/\D/g, '') : v.replace(/[^\d.,]/g, ''));
          setMessage(undefined);
        }}
        placeholder={mode === 'page' && reading.currentPage ? String(reading.currentPage) : undefined}
        inputMode={mode === 'page' ? 'numeric' : 'decimal'}
        maxLength={mode === 'page' ? 5 : 5}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {message && <Notice message={message.text} tone={message.tone} />}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button label={t('reading.save')} onPress={save} loading={busy} disabled={!value} />
      </View>
    </View>
  );
}
