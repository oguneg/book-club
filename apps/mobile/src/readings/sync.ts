import { readingResponse } from '@bookclub/shared';
import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { ApiError, apiPost } from '@/api/client';
import { addPending, type PendingLog } from './pending';
import { loadPending, savePending } from './pendingStorage';

/**
 * Sending progress logs. Every log goes into the device's queue first and is shown at once; the queue is
 * sent in order whenever the server can be reached. A log the server refuses (the book was finished on
 * another device, say) comes off the queue and is reported, never dropped quietly.
 */

export type RefusedLog = { log: PendingLog; error: unknown };
export type ProgressSyncState = {
  userId: string | null;
  pending: PendingLog[];
  syncing: boolean;
  /** The last attempt couldn't reach the server: logs are waiting for a connection. */
  offline: boolean;
  refused: RefusedLog[];
};

let state: ProgressSyncState = { userId: null, pending: [], syncing: false, offline: false, refused: [] };
const listeners = new Set<() => void>();
let queryClient: QueryClient | null = null;
let running: Promise<void> = Promise.resolve();

function set(patch: Partial<ProgressSyncState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function setPending(pending: PendingLog[]) {
  set({ pending });
  if (state.userId) savePending(state.userId, pending);
}

/** Signed in: pick up whatever this account left waiting on this device. */
export function startProgressSync(userId: string, client: QueryClient) {
  queryClient = client;
  if (state.userId !== userId) set({ userId, pending: loadPending(userId), syncing: false, offline: false, refused: [] });
}

/** Signed out: forget the queue in memory (it stays stored for that account). */
export function stopProgressSync() {
  set({ userId: null, pending: [], syncing: false, offline: false, refused: [] });
}

/** Network trouble or a server having a bad moment: try again later. Anything else is a refusal. */
const tryAgainLater = (error: unknown) =>
  !(error instanceof ApiError) || error.status === 401 || error.status === 408 || error.status === 429 || error.status >= 500;

async function send() {
  const userId = state.userId;
  if (!userId || state.pending.length === 0) return;
  set({ syncing: true });
  const changed = new Set<string>();
  let offline = false;
  for (const log of [...state.pending]) {
    if (state.userId !== userId) return;
    const { readingId, at } = log;
    const body = 'page' in log ? { page: log.page, at } : { percent: log.percent, at };
    try {
      const { reading } = await apiPost(`/api/readings/${encodeURIComponent(readingId)}/progress`, body, readingResponse);
      setPending(state.pending.filter((p) => p.id !== log.id));
      // The server's copy, unless more for this book is still waiting (it would look like a step back).
      if (!state.pending.some((p) => p.readingId === readingId)) queryClient?.setQueryData(['reading', readingId], reading);
      changed.add(readingId);
    } catch (error) {
      if (tryAgainLater(error)) {
        offline = true;
        break;
      }
      setPending(state.pending.filter((p) => p.id !== log.id));
      set({ refused: [...state.refused, { log, error }] });
      changed.add(readingId);
      void queryClient?.invalidateQueries({ queryKey: ['reading', readingId] });
    }
  }
  set({ syncing: false, offline });
  if (changed.size > 0 && queryClient) {
    for (const key of ['readings', 'club-progress', 'notes', 'reading-stats', 'activity']) void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

/** Send what's waiting, one pass at a time (a pass already under way finishes first). */
export function syncProgress(): Promise<void> {
  running = running.then(send, send);
  return running;
}

/**
 * Log a page or percentage. Resolves "saved" once the server has it, or "waiting" when it's kept on this
 * device for later; throws when the server refuses it, so the form can say why.
 */
export async function logProgress(readingId: string, input: { page: number } | { percent: number }): Promise<'saved' | 'waiting'> {
  const log = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, readingId, at: new Date().toISOString(), ...input } as PendingLog;
  setPending(addPending(state.pending, log));
  await syncProgress();
  const refused = state.refused.find((r) => r.log.id === log.id);
  if (refused) {
    set({ refused: state.refused.filter((r) => r !== refused) });
    throw refused.error;
  }
  return state.pending.some((p) => p.id === log.id) ? 'waiting' : 'saved';
}

export function dismissRefused(log: PendingLog) {
  set({ refused: state.refused.filter((r) => r.log.id !== log.id) });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgressSync(): ProgressSyncState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
