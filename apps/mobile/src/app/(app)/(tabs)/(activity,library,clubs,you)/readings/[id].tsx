import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ReadingView } from '@/components/ReadingView';

/**
 * A book's own page (yours, with your club on it when it's a club book). `?open=update` asks "Where are
 * you?" on arrival (just started), `?open=note` opens a note (a last thought after finishing).
 */
export default function ReadingPage() {
  const { id, open } = useLocalSearchParams<{ id: string; open?: string }>();
  // Once handled, drop the param so coming back to the page doesn't open the sheet again.
  const onOpened = useCallback(() => router.setParams({ open: undefined }), []);
  return (
    <ReadingView
      readingId={id}
      open={open === 'update' || open === 'note' ? open : undefined}
      onOpened={onOpened}
    />
  );
}
