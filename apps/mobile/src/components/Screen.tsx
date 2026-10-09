import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

/** Page wrapper: safe areas, theme background, and a readable column width on tablets and web. */
export function Screen({ children, width = 'default' }: { children: ReactNode; width?: 'default' | 'narrow' }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + theme.space.xl,
          paddingBottom: insets.bottom + theme.space.xl,
          paddingHorizontal: theme.space.lg,
        },
      ]}
    >
      <View role="main" style={[styles.column, { maxWidth: width === 'narrow' ? 420 : 560 }]}>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%' },
});
