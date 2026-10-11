import type { PushState } from './state';

export type { PushState } from './state';

// The web app has no push: notifications are the bell's list (live while the app is open).

export async function pushState(): Promise<PushState> {
  return 'unsupported';
}

export async function registerPush(): Promise<void> {}

export async function enablePush(): Promise<PushState> {
  return 'unsupported';
}

export async function forgetPush(): Promise<void> {}

export function setBadge(_count: number) {}

export function useNotificationTaps() {}
