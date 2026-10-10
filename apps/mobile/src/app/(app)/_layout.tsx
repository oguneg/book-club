import { Stack } from 'expo-router';
import { useAppearanceSync } from '@/api/preferences';
import { useLive } from '@/live/useLive';
import { useProgressSyncEngine } from '@/readings/useProgressSyncEngine';
import { useTheme } from '@/theme';

// Opened from a link (a club, a book), the tabs are still underneath: Back leads into the app.
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppGroupLayout() {
  const { colors } = useTheme();
  // Signed in: keep a live connection so changes from other devices and club members show up.
  useLive();
  // Progress logged offline (or left from a visit without a connection) goes out when it can.
  useProgressSyncEngine();
  // Your style and light/dark follow your account from device to device.
  useAppearanceSync();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
