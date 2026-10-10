import type { Reading } from '@bookclub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CloudOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '@/components/ui/TextButton';
import { readingErrorMessage } from '@/readings/errors';
import { dismissRefused, syncProgress, useProgressSync } from '@/readings/sync';
import { useTheme } from '@/theme';

/**
 * The state of progress kept on this device, so logging offline never feels like it vanished: how many
 * updates are waiting (with "Sync now"), or a log the server refused and why. Nothing when all is sent.
 * Above the tab bar on phones; at the foot of the sidebar on wide screens.
 */
export function SyncBar({ placement = 'bar' }: { placement?: 'bar' | 'sidebar' }) {
  const { t } = useTranslation();
  const { colors, fontSize, radius, space } = useTheme();
  const queryClient = useQueryClient();
  const { pending, syncing, refused } = useProgressSync();
  if (pending.length === 0 && refused.length === 0) return null;

  const frame =
    placement === 'bar'
      ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: space.lg }
      : { position: 'absolute' as const, left: space.sm, right: space.sm, bottom: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md };
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, minHeight: 44, flexWrap: 'wrap' as const };
  const text = { flex: 1, minWidth: 120, color: colors.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.4 };

  const first = refused[0];
  if (first) {
    const title = queryClient.getQueryData<Reading[]>(['readings'])?.find((r) => r.id === first.log.readingId)?.edition.title;
    const what = 'page' in first.log ? t('sync.whatPage', { page: first.log.page }) : t('sync.whatPercent', { percent: first.log.percent });
    return (
      <View role="alert" style={[frame, { backgroundColor: colors.surface, paddingVertical: space.xs }]}>
        <View style={row}>
          <CircleAlert size={18} color={colors.danger} strokeWidth={1.75} aria-hidden />
          <Text style={text}>
            {t('sync.refused', { what, title: title ?? t('sync.yourBook'), reason: readingErrorMessage(t, first.error) })}
          </Text>
          <TextButton label={t('sync.dismiss')} onPress={() => dismissRefused(first.log)} />
        </View>
      </View>
    );
  }

  return (
    <View role="status" accessibilityLiveRegion="polite" style={[frame, { backgroundColor: colors.surface, paddingVertical: space.xs }]}>
      <View style={row}>
        <CloudOff size={18} color={colors.textMuted} strokeWidth={1.75} aria-hidden />
        <Text style={text}>{syncing ? t('sync.syncing') : t('sync.waiting', { count: pending.length })}</Text>
        {syncing ? <ActivityIndicator size="small" color={colors.accent} /> : <TextButton label={t('sync.now')} onPress={() => void syncProgress()} />}
      </View>
    </View>
  );
}
