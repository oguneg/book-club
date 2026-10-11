import { forgetPush } from '@/notifications/push';
import { authClient } from './client';

/** Signs out on this device; on a phone, it first stops getting this account's notifications. */
export async function signOut() {
  await forgetPush().catch(() => {});
  await authClient.signOut();
}
