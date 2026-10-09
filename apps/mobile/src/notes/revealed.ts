import { useCallback, useSyncExternalStore } from 'react';

// Notes ahead of you that you chose to read. Once you've said "Show note", that note is shown wherever it
// appears (the timeline and the list) until the app is closed; the choice is about the note, not the card.

const revealed = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRevealed(noteId: string): [boolean, () => void] {
  const isRevealed = useSyncExternalStore(
    subscribe,
    () => revealed.has(noteId),
    () => false,
  );
  const reveal = useCallback(() => {
    if (revealed.has(noteId)) return;
    revealed.add(noteId);
    for (const l of listeners) l();
  }, [noteId]);
  return [isRevealed, reveal];
}
