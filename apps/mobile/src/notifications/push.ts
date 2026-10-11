import Constants from 'expo-constants';
import { getCalendars } from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { forgetDevice, registerDevice } from '@/api/notifications';
import type { PushState } from './state';

export type { PushState } from './state';

// Push on phones (the web app has the bell only). While the app is open a notification still shows as a
// banner; the bell's count updates live anyway.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
});

export async function pushState(): Promise<PushState> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

async function pushToken(): Promise<string | null> {
  const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Bookclub', importance: Notifications.AndroidImportance.DEFAULT });
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    // A simulator without push, or no connection: the next launch tries again.
    return null;
  }
}

/** Tells the server this phone may be pushed to, when notifications are allowed. Every launch: tokens change. */
export async function registerPush(): Promise<void> {
  if ((await pushState()) !== 'granted') return;
  const token = await pushToken();
  if (!token) return;
  await registerDevice({ token, platform: Platform.OS === 'android' ? 'android' : 'ios', timeZone: getCalendars()[0]?.timeZone ?? undefined });
}

/** Asks the phone (it asks only once; after a no, this opens Settings), then registers. */
export async function enablePush(): Promise<PushState> {
  const state = await pushState();
  if (state === 'denied') {
    await Linking.openSettings();
    return state;
  }
  if (state === 'undetermined') {
    const answer = await Notifications.requestPermissionsAsync();
    if (!answer.granted) return answer.canAskAgain ? 'undetermined' : 'denied';
  }
  await registerPush().catch(() => {});
  return 'granted';
}

/** Before signing out: this phone stops getting that account's pushes. */
export async function forgetPush(): Promise<void> {
  if ((await pushState()) !== 'granted') return;
  const token = await pushToken();
  if (token) await forgetDevice(token).catch(() => {});
}

/** The number on the app icon: unread notifications. */
export function setBadge(count: number) {
  void Notifications.setBadgeCountAsync(count).catch(() => {});
}

/** A tapped notification opens what it's about (once, also when it launched the app). */
export function useNotificationTaps() {
  useEffect(() => {
    const open = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
      Notifications.clearLastNotificationResponse();
    };
    const launched = Notifications.getLastNotificationResponse();
    if (launched) open(launched.notification);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification));
    return () => subscription.remove();
  }, []);
}
