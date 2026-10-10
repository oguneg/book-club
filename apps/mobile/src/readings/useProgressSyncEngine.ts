import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { authClient } from '@/auth/client';
import { startProgressSync, stopProgressSync, syncProgress, useProgressSync } from './sync';

const RETRY_EVERY_MS = 30_000;

/**
 * Keeps progress logged on this device moving to the server: on sign-in (what an earlier visit left behind),
 * when the connection comes back, when the app returns to the front, and every half minute while anything
 * is still waiting.
 */
export function useProgressSyncEngine() {
  const queryClient = useQueryClient();
  const userId = authClient.useSession().data?.user.id;
  const waiting = useProgressSync().pending.length > 0;

  useEffect(() => {
    if (!userId) return;
    startProgressSync(userId, queryClient);
    void syncProgress();
    return () => stopProgressSync();
  }, [userId, queryClient]);

  useEffect(() => {
    if (!waiting) return;
    const offOnline = onlineManager.subscribe((online) => {
      if (online) void syncProgress();
    });
    const offFront = AppState.addEventListener('change', (status) => {
      if (status === 'active') void syncProgress();
    });
    const timer = setInterval(() => void syncProgress(), RETRY_EVERY_MS);
    return () => {
      offOnline();
      offFront.remove();
      clearInterval(timer);
    };
  }, [waiting]);
}
