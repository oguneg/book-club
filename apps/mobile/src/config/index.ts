import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiUrl } from './resolveApiUrl';

export const API_URL = resolveApiUrl({
  // Must be written out in full: Expo inlines EXPO_PUBLIC_* variables at build time.
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  isDev: __DEV__,
  platform: Platform.OS,
  hostUri: Constants.expoConfig?.hostUri,
  webHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : undefined,
});
