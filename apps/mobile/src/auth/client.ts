import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '@/config';

// Web: the session is an HttpOnly cookie the browser keeps and sends by itself. Native: the Expo plugin keeps
// the session cookie in the device's secure storage, sends it with sign-in requests, and brings Google sign-in
// back into the app through its scheme (bookclub://). On the web the plugin stays out of the way.
export const authClient = createAuthClient({
  baseURL: API_URL || undefined,
  basePath: '/api/auth',
  plugins: [expoClient({ scheme: 'bookclub', storagePrefix: 'bookclub', storage: SecureStore })],
});

/** Headers that carry the session to our own API: on native the stored cookie, on the web nothing (the browser sends it). */
export async function sessionHeaders(): Promise<Record<string, string>> {
  if (Platform.OS === 'web') return {};
  const cookie = await authClient.getCookie();
  return cookie ? { Cookie: cookie } : {};
}

/** Absolute URL of a page in the web app, for links the server sends back (emails, OAuth redirects). */
export function appUrl(path: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${path}`;
  // Native: a path; the Expo plugin turns it into a link back into the app.
  return path;
}
