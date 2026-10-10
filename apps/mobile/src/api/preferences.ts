import { preferencesResponse, type AppearancePreference } from '@bookclub/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppearance, type Appearance } from '@/theme';
import { apiGet, apiPut } from './client';

// The appearance follows your account: the device keeps its own copy (so the app starts in your style
// before it can ask the server), and the account's choice wins once you're signed in.

/** A change this device couldn't send yet (offline); it wins over the server's until it's sent. */
let unsent: AppearancePreference | null = null;

const same = (a: Appearance, b: AppearancePreference) => a.style === b.style && a.mode === b.mode;

export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: async ({ signal }) => apiGet('/api/preferences', preferencesResponse, signal),
  });
}

async function send(appearance: AppearancePreference) {
  try {
    await apiPut('/api/preferences', { appearance }, preferencesResponse);
    unsent = null;
  } catch {
    unsent = appearance;
  }
}

/** Change the appearance here and on every device you're signed in on. */
export function useChangeAppearance() {
  const { appearance, setAppearance } = useAppearance();
  const queryClient = useQueryClient();
  return (change: Partial<Appearance>) => {
    const next = { ...appearance, ...change };
    setAppearance(next);
    queryClient.setQueryData(['preferences'], { appearance: next });
    void send(next);
  };
}

/**
 * Signed in: take the account's appearance (it changes live when another device changes it). An account
 * without one yet takes this device's; a change made offline is sent first.
 */
export function useAppearanceSync() {
  const queryClient = useQueryClient();
  const { appearance, setAppearance } = useAppearance();
  const prefs = usePreferences();
  const remote = prefs.isSuccess ? prefs.data.appearance : undefined;

  useEffect(() => {
    if (remote === undefined) return;
    if (unsent) {
      void send(unsent);
      return;
    }
    if (remote === null) {
      queryClient.setQueryData(['preferences'], { appearance });
      void send(appearance);
    } else if (!same(appearance, remote)) {
      setAppearance(remote);
    }
  }, [remote, appearance, setAppearance, queryClient]);
}
