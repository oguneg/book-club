import { Platform } from 'react-native';

// An invite opened while signed out has to survive signing up, which can mean confirming the email in
// another tab. On web it's kept in localStorage for a day; elsewhere in memory (native comes with iOS).

const KEY = 'bookclub.pendingInvite';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
let inMemory: string | null = null;

function storage(): Storage | null {
  try {
    return Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function rememberInvite(code: string): void {
  inMemory = code;
  try {
    storage()?.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Private mode or blocked storage: the in-memory copy still covers this tab.
  }
}

/** The invite to return to after signing in, once; null when there is none (or it's older than a day). */
export function takePendingInvite(): string | null {
  let code = inMemory;
  inMemory = null;
  try {
    const raw = storage()?.getItem(KEY);
    storage()?.removeItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { code?: string; at?: number };
      if (saved.code && saved.at && Date.now() - saved.at < MAX_AGE_MS) code = saved.code;
    }
  } catch {
    // Ignore unreadable storage.
  }
  return code;
}
