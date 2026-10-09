import { Stack } from 'expo-router';
import { useLive } from '@/live/useLive';
import { useTheme } from '@/theme';

// Opened from a link (a club, a book), the tabs are still underneath: Back leads into the app.
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppGroupLayout() {
  const { colors } = useTheme();
  // Signed in: keep a live connection so changes from other devices and club members show up.
  useLive();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
