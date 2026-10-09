import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

/** A button that asks before it acts: the first press shows the question and a confirm/cancel pair. */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  variant = 'secondary',
  danger = false,
  quiet = false,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  variant?: 'primary' | 'secondary';
  danger?: boolean;
  /** A text-style trigger, for rare actions that shouldn't look like buttons on the page. */
  quiet?: boolean;
}) {
  const { colors, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!asking) {
    return (
      <View style={{ alignSelf: 'flex-start' }}>
        {quiet ? (
          <TextButton tone={danger ? 'danger' : 'accent'} label={label} onPress={() => setAsking(true)} />
        ) : (
          <Button variant={variant} label={label} onPress={() => setAsking(true)} />
        )}
      </View>
    );
  }
  return (
    <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
      <Text style={{ color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5 }}>{question}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button
          variant={danger ? 'danger' : 'primary'}
          label={confirmLabel}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              setAsking(false);
            }
          }}
        />
        <Button variant="secondary" label={t('common.cancel')} onPress={() => setAsking(false)} disabled={busy} />
      </View>
    </View>
  );
}
