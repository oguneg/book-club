import { healthResponse } from '@bookclub/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiGet } from '@/api/client';
import { useTheme } from '@/theme';

export function ServerStatus() {
  const theme = useTheme();
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => apiGet('/api/health', healthResponse, signal),
    retry: 1,
  });

  let label: string;
  let color = theme.colors.textMuted;
  if (health.isPending) {
    label = t('server.checking');
  } else if (health.isError) {
    label = t('server.unreachable');
    color = theme.colors.danger;
  } else if (!health.data.db) {
    label = t('server.degraded');
    color = theme.colors.danger;
  } else {
    label = t('server.connected', { env: health.data.env, version: health.data.version });
    color = theme.colors.success;
  }

  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color: theme.colors.textMuted, fontSize: theme.fontSize.sm }]}>{label}</Text>
      {health.isError && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void health.refetch()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ color: theme.colors.accent, fontSize: theme.fontSize.sm, fontWeight: '600' }}>
            {t('server.retry')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flexShrink: 1 },
});
