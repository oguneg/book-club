import type { Logger } from 'pino';

// Push through Expo's push service (free): it relays to Apple (and Google). An access token is only needed
// when "enhanced security for push notifications" is switched on for the Expo project.

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  /** `url`: where a tap opens the app. */
  data: { url: string | null };
  /** The app icon's badge: unread notifications. */
  badge: number;
  sound: 'default';
}

/** Sends pushes; returns the tokens Expo says are dead (the app was deleted), so they can be dropped. */
export type PushSender = (messages: PushMessage[]) => Promise<{ deadTokens: string[] }>;

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';
/** Expo takes up to 100 messages per request. */
const BATCH = 100;

export function expoPush({ fetch: fetchFn, accessToken, log }: { fetch: typeof fetch; accessToken?: string; log: Logger }): PushSender {
  return async (messages) => {
    const deadTokens: string[] = [];
    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages.slice(i, i + BATCH);
      try {
        const res = await fetchFn(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          log.warn({ status: res.status }, 'push send failed');
          continue;
        }
        const body = (await res.json()) as { data?: { status: string; message?: string; details?: { error?: string } }[] };
        body.data?.forEach((ticket, j) => {
          if (ticket.status !== 'error') return;
          if (ticket.details?.error === 'DeviceNotRegistered') deadTokens.push(batch[j]!.to);
          else log.warn({ error: ticket.details?.error, message: ticket.message }, 'push refused');
        });
      } catch (err) {
        log.warn({ err }, 'push send failed');
      }
    }
    return { deadTokens };
  };
}
