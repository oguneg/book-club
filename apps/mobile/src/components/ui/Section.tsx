import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';

/** A titled card on settings-style pages. */
export function Section({ title, children, tone = 'normal' }: { title: string; children: ReactNode; tone?: 'normal' | 'danger' }) {
  const { colors, fonts, fontSize, radius, space } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: tone === 'danger' ? colors.danger : colors.border,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.md,
        },
      ]}
    >
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: tone === 'danger' ? colors.danger : colors.text }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** A label/value line inside a section, with optional actions on the right or below. */
export function Row({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  const { colors, fontSize, space } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.row}>
        <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '600' }}>{label}</Text>
        {value !== undefined && <Text style={{ color: colors.textMuted, fontSize: fontSize.md, flexShrink: 1, textAlign: 'right' }}>{value}</Text>}
      </View>
      {children}
    </View>
  );
}

/** Supporting text under a row or section title. */
export function Hint({ children }: { children: ReactNode }) {
  const { colors, fontSize } = useTheme();
  return <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
});
