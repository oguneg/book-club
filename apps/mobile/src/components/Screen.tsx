import { useQueryClient } from '@tanstack/react-query';
import { useContext, useState, type ReactNode } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { HeaderShownContext } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

/**
 * Page wrapper: safe areas, theme background, and a readable column width (`wide` leaves room for a side
 * rail). `overlay` stays put while the page scrolls (a floating "+ Note"); the page leaves room for it.
 */
export function Screen({
  children,
  width = 'default',
  overlay,
  region,
}: {
  children: ReactNode;
  width?: 'default' | 'narrow' | 'wide';
  overlay?: ReactNode;
  /** Shown beside another page (a desktop pane): a named region rather than a second main. */
  region?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Under a header (a book, a club, a form opened from a tab) the header already clears the status bar.
  const underHeader = useContext(HeaderShownContext);
  // Pull to refresh, as phones expect: everything on screen asks the server again.
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await queryClient.refetchQueries({ type: 'active' }).catch(() => {});
    setRefreshing(false);
  };
  return (
    <View style={styles.fill}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={Platform.OS === 'web' ? undefined : <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.colors.accent} />}
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: underHeader ? theme.space.sm : insets.top + theme.space.xl,
            paddingBottom: insets.bottom + theme.space.xl + (overlay ? 72 : 0),
            paddingHorizontal: theme.space.lg,
          },
        ]}
      >
        <View role={region ? 'region' : 'main'} aria-label={region} style={[styles.column, { maxWidth: theme.layout[width === 'default' ? 'column' : width] }]}>
          {children}
        </View>
      </ScrollView>
      {overlay && (
        // Lined up with the column, so on a wide screen the button stays by the page, not the window's edge.
        <View
          pointerEvents="box-none"
          style={[styles.overlay, { paddingBottom: insets.bottom + theme.space.lg, paddingHorizontal: theme.space.lg }]}
        >
          <View pointerEvents="box-none" style={[styles.column, { maxWidth: theme.layout[width === 'default' ? 'column' : width], alignItems: 'flex-end' }]}>
            {overlay}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
});
