import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';

/**
 * The one raised surface on a screen: where you do the thing you came for (log your page, write a note).
 * Everything else on the page is set flat in type.
 */
export function Desk({ children, label }: { children: ReactNode; label?: string }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      role={label ? 'region' : undefined}
      aria-label={label}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: space.lg,
        gap: space.md,
        boxShadow: colors.deskShadow,
      }}
    >
      {children}
    </View>
  );
}
