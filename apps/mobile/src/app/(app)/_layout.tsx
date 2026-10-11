import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useUnreadCount } from '@/api/notifications';
import { useAppearanceSync } from '@/api/preferences';
import { registerPush, setBadge, useNotificationTaps } from '@/notifications/push';
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
  // Phones: pushes reach this account (the token can change, so every launch), a tap opens what it's
  // about, and the app icon counts what's unread.
  useNotificationTaps();
  useEffect(() => {
    void registerPush().catch(() => {});
  }, []);
  const unread = useUnreadCount();
  useEffect(() => setBadge(unread), [unread]);
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
