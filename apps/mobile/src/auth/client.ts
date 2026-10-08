import { createAuthClient } from 'better-auth/react';
import { Platform } from 'react-native';
import { API_URL } from '@/config';

// Web: the session is an HttpOnly cookie set by the API (same origin when deployed, the local API in dev).
// Native sign-in (secure storage, deep links) arrives with the iOS step.
export const authClient = createAuthClient({
  baseURL: API_URL || undefined,
  basePath: '/api/auth',
});

/** Absolute URL of a page in the web app, for links the server sends back (emails, OAuth redirects). */
export function appUrl(path: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return path;
}
