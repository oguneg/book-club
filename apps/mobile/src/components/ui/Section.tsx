import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';

/**
 * A section of a page, set like a book rather than boxed: a hairline rule, a small-caps heading, then the
 * content. `action` sits at the end of the heading line (e.g. "Manage").
 */
export function Section({
  title,
  children,
  tone = 'normal',
  action,
}: {
  title: string;
  children: ReactNode;
  tone?: 'normal' | 'danger';
  action?: ReactNode;
}) {
  const { colors, fonts, fontSize, space } = useTheme();
  const color = tone === 'danger' ? colors.danger : colors.textMuted;
  return (
    <View style={{ gap: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tone === 'danger' ? colors.danger : colors.border }}>
      <View style={styles.headingLine}>
        <Text
          accessibilityRole="header"
          aria-level={2}
          style={{ fontFamily: fonts.heading, fontSize: fontSize.sm, letterSpacing: 1.4, textTransform: 'uppercase', color }}
        >
          {title}
        </Text>
        {action}
      </View>
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
  headingLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
});
