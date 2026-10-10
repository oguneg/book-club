import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { sessionHeaders } from '@/auth/client';
import { API_URL } from '@/config';

type LiveEvent =
  | { type: 'readings' }
  | { type: 'club'; clubId: string }
  | { type: 'club-progress'; clubId: string }
  | { type: 'notes'; bookKey: string }
  | { type: 'preferences' };

/** React Native's WebSocket also takes headers (the DOM type in our tsconfig doesn't know that). */
type NativeWebSocket = new (url: string, protocols: string | string[] | undefined, options: { headers: Record<string, string> }) => WebSocket;

/** ws(s)://<api>/api/live: the API's origin, or the page's own origin when the web app is served by the API. */
function liveUrl(): string | null {
  const base = API_URL || (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) return null;
  return `${base.replace(/^http/, 'ws')}/api/live`;
}

/**
 * Keeps one WebSocket open while signed in. The server only says what changed; we refetch it. Reconnects
 * with backoff (1 s doubling to 30 s), and refreshes everything after a reconnect in case events were missed.
 */
export function useLive() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const url = liveUrl();
    if (!url) return;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;
    let stopped = false;
    let everConnected = false;

    const onEvent = (event: LiveEvent) => {
      if (event.type === 'readings') {
        void queryClient.invalidateQueries({ queryKey: ['readings'] });
        void queryClient.invalidateQueries({ queryKey: ['reading'] });
      } else if (event.type === 'club') {
        void queryClient.invalidateQueries({ queryKey: ['club', event.clubId] });
        void queryClient.invalidateQueries({ queryKey: ['clubs'] });
        void queryClient.invalidateQueries({ queryKey: ['activity'] });
      } else if (event.type === 'club-progress') {
        void queryClient.invalidateQueries({ queryKey: ['club-progress', event.clubId] });
        void queryClient.invalidateQueries({ queryKey: ['activity'] });
      } else if (event.type === 'notes') {
        void queryClient.invalidateQueries({ queryKey: ['notes', event.bookKey] });
        void queryClient.invalidateQueries({ queryKey: ['activity'] });
      } else if (event.type === 'preferences') {
        void queryClient.invalidateQueries({ queryKey: ['preferences'] });
      }
    };

    const connect = async () => {
      if (stopped) return;
      // Native sockets carry the stored session cookie; browsers send theirs by themselves.
      const headers = await sessionHeaders();
      if (stopped) return;
      socket = Platform.OS === 'web' ? new WebSocket(url) : new (WebSocket as unknown as NativeWebSocket)(url, undefined, { headers });
      socket.onopen = () => {
        delay = 1000;
        if (everConnected) void queryClient.invalidateQueries();
        everConnected = true;
      };
      socket.onmessage = (message) => {
        try {
          onEvent(JSON.parse(String(message.data)) as LiveEvent);
        } catch {
          // Ignore anything unexpected.
        }
      };
      socket.onclose = () => {
        socket = null;
        if (stopped) return;
        retry = setTimeout(() => void connect(), delay);
        delay = Math.min(delay * 2, 30_000);
      };
    };

    void connect();
    // Coming back to the app: reconnect right away instead of waiting out the backoff.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !socket) {
        clearTimeout(retry);
        delay = 1000;
        void connect();
      }
    });

    return () => {
      stopped = true;
      clearTimeout(retry);
      appState.remove();
      socket?.close();
    };
  }, [queryClient]);
}
