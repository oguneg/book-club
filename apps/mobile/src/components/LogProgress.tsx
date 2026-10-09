import type { ReadingDetail } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';
import { useReadingActions } from '@/api/readings';
import { readingErrorMessage } from '@/readings/errors';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

type LoggableReading = Pick<ReadingDetail, 'id' | 'endPage' | 'currentPage'> & { history?: ReadingDetail['history'] };

/**
 * "I'm on page [ 160 ] of 320 · Save": moving your bookmark is one sentence and one tap. E-book readers
 * switch to a percentage once; if their last log was a percentage, that's what they get next time.
 */
export function LogProgress({ reading }: { reading: LoggableReading }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space, minTouch } = useTheme();
  const actions = useReadingActions(reading.id);
  const history = reading.history ?? [];
  const lastWasPercent = history.length > 0 && history[history.length - 1]?.page === null;
  const [mode, setMode] = useState<'page' | 'percent'>(lastWasPercent ? 'percent' : 'page');
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' }>();
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = Number(value.replace(',', '.'));
    if (!value) return;
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

  const words = { color: colors.text, fontSize: fontSize.md };
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: space.sm }}>
        <Text style={words}>{mode === 'page' ? t('reading.onPage') : t('reading.atPercent')}</Text>
        <TextInput
          accessibilityLabel={mode === 'page' ? t('reading.logPage') : t('reading.logPercent')}
          aria-invalid={message?.tone === 'error'}
          value={value}
          onChangeText={(v) => {
            setValue(mode === 'page' ? v.replace(/\D/g, '') : v.replace(/[^\d.,]/g, ''));
            setMessage(undefined);
          }}
          placeholder={mode === 'page' && reading.currentPage ? String(reading.currentPage) : undefined}
          placeholderTextColor={colors.textMuted}
          inputMode={mode === 'page' ? 'numeric' : 'decimal'}
          maxLength={5}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            {
              width: 76,
              minHeight: minTouch,
              borderWidth: 1,
              borderRadius: radius.md,
              borderColor: message?.tone === 'error' ? colors.danger : focused ? colors.accent : colors.control,
              backgroundColor: colors.background,
              color: colors.text,
              fontFamily: fonts.reading,
              fontSize: fontSize.lg,
              fontVariant: ['tabular-nums'],
              textAlign: 'center',
              outlineStyle: 'none',
            } as object,
            focused && { boxShadow: `0 0 0 1px ${colors.accent}` },
          ]}
        />
        <Text style={words}>{mode === 'page' ? t('reading.ofPages', { end: reading.endPage }) : t('reading.percentSign')}</Text>
        <Button label={t('reading.save')} onPress={() => void save()} loading={busy} disabled={!value} />
      </View>
      {message && <Notice message={message.text} tone={message.tone} />}
      <View style={{ alignSelf: 'flex-start' }}>
        <TextButton
          tone="muted"
          label={mode === 'page' ? t('reading.usePercent') : t('reading.usePage')}
          onPress={() => {
            setMode(mode === 'page' ? 'percent' : 'page');
            setValue('');
            setMessage(undefined);
          }}
        />
      </View>
    </View>
  );
}
