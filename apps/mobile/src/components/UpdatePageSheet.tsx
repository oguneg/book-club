import type { ReadingDetail } from '@bookclub/shared';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useReadingActions } from '@/api/readings';
import { readingErrorMessage } from '@/readings/errors';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useToast } from '@/components/Toast';
import { Sheet } from '@/components/ui/Sheet';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

/** A light tap of confirmation on phones (the web's vibration would just be odd). */
const feelSaved = () => {
  if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

type Updatable = Pick<ReadingDetail, 'id' | 'endPage' | 'currentPage'> & { startPage?: number; history?: ReadingDetail['history'] };

/**
 * "Where are you?": one big number, a few quick steps forward, Save. Reaching the last page offers to mark
 * the book finished right there, so nobody has to go looking for it.
 */
export function UpdatePageSheet({
  reading,
  visible,
  onClose,
  bookTitle,
  onFinished,
}: {
  reading: Updatable;
  visible: boolean;
  onClose: () => void;
  /** Named in the title when the page around it shows several books. */
  bookTitle?: string;
  /** After "Yes, I finished it": the page around shows the ending. */
  onFinished?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space, minTouch } = useTheme();
  const actions = useReadingActions(reading.id);
  const toast = useToast();
  const history = reading.history ?? [];
  const lastWasPercent = history.length > 0 && history[history.length - 1]?.page === null;
  const [mode, setMode] = useState<'page' | 'percent'>(lastWasPercent ? 'percent' : 'page');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [finishedPrompt, setFinishedPrompt] = useState(false);
  const current = reading.currentPage ?? 0;

  const close = () => {
    setValue('');
    setError(undefined);
    setFinishedPrompt(false);
    onClose();
  };

  async function save() {
    const n = Number(value.replace(',', '.'));
    if (!value) return;
    if (mode === 'page' && (!Number.isInteger(n) || n < 0 || n > reading.endPage)) return setError(t('reading.pageInvalid', { max: reading.endPage }));
    if (mode === 'percent' && (Number.isNaN(n) || n < 0 || n > 100)) return setError(t('reading.percentInvalid'));
    setBusy(true);
    setError(undefined);
    try {
      await (mode === 'page' ? actions.logPage(n) : actions.logPercent(n));
      if ((mode === 'page' && n >= reading.endPage) || (mode === 'percent' && n >= 100)) setFinishedPrompt(true);
      else {
        close();
        // A little "well done" for moving on; a correction backwards is just saved.
        const moved = mode === 'page' ? n - current : 0;
        toast(moved > 0 ? t('reading.update.toastPages', { count: moved }) : t('reading.update.toastSaved'));
        feelSaved();
      }
    } catch (err) {
      setError(readingErrorMessage(t, err));
    }
    setBusy(false);
  }

  const step = (n: number) => (
    <Pressable
      key={n}
      accessibilityRole="button"
      accessibilityLabel={t('reading.update.stepLabel', { count: n })}
      onPress={() => {
        setError(undefined);
        setValue(String(Math.min(reading.endPage, (Number(value) || current) + n)));
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: minTouch - 4,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.control,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{`+${n}`}</Text>
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={close} title={finishedPrompt ? t('reading.update.endTitle') : bookTitle ? t('reading.update.titleIn', { title: bookTitle }) : t('reading.update.title')}>
      {finishedPrompt ? (
        <View style={{ gap: space.md, paddingBottom: space.sm }}>
          <Text style={{ color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{t('reading.update.endBody')}</Text>
          <Button
            label={t('reading.update.markFinished')}
            onPress={async () => {
              try {
                await actions.finish();
                feelSaved();
                close();
                onFinished?.();
              } catch (err) {
                setError(readingErrorMessage(t, err));
              }
            }}
          />
          <Button variant="secondary" label={t('reading.update.notYet')} onPress={close} />
        </View>
      ) : (
        <View style={{ gap: space.lg, paddingBottom: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>{mode === 'page' ? t('reading.update.page') : ''}</Text>
            <TextInput
              autoFocus
              accessibilityLabel={mode === 'page' ? t('reading.logPage') : t('reading.logPercent')}
              aria-invalid={Boolean(error)}
              value={value}
              onChangeText={(v) => {
                setValue(mode === 'page' ? v.replace(/\D/g, '') : v.replace(/[^\d.,]/g, ''));
                setError(undefined);
              }}
              placeholder={mode === 'page' ? String(current || '') : undefined}
              placeholderTextColor={colors.textMuted}
              inputMode={mode === 'page' ? 'numeric' : 'decimal'}
              maxLength={5}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              style={
                {
                  width: 140,
                  minHeight: 64,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  borderColor: error ? colors.danger : colors.control,
                  backgroundColor: colors.background,
                  color: colors.text,
                  fontFamily: fonts.reading,
                  fontSize: fontSize.xxl,
                  fontVariant: ['tabular-nums'],
                  textAlign: 'center',
                } as object
              }
            />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>
              {mode === 'page' ? t('reading.ofPages', { end: reading.endPage }) : t('reading.update.percent')}
            </Text>
          </View>
          {mode === 'page' && <View style={{ flexDirection: 'row', gap: space.sm }}>{[5, 10, 25].map(step)}</View>}
          {error && <Notice message={error} />}
          <Button label={t('reading.save')} onPress={() => void save()} loading={busy} disabled={!value} />
          {reading.currentPage === null && mode === 'page' && (
            // A book just started: one tap to say so, instead of typing page 1.
            <Button
              variant="secondary"
              label={t('reading.update.justStarted')}
              onPress={async () => {
                setBusy(true);
                try {
                  await actions.logPage(reading.startPage ?? 1);
                  close();
                } catch (err) {
                  setError(readingErrorMessage(t, err));
                }
                setBusy(false);
              }}
            />
          )}
          <View style={{ alignSelf: 'center' }}>
            <TextButton
              tone="muted"
              label={mode === 'page' ? t('reading.usePercent') : t('reading.usePage')}
              onPress={() => {
                setMode(mode === 'page' ? 'percent' : 'page');
                setValue('');
                setError(undefined);
              }}
            />
          </View>
        </View>
      )}
    </Sheet>
  );
}
