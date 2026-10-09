import { Platform } from 'react-native';
import { ApiError } from '@/api/client';
import { API_URL } from '@/config';

// Crashes in the app go to our own server, which forwards them to error tracking: no third party is
// contacted from the reader's device, and there's no DSN in the app. Only technical details are sent:
// the error, its stack and the page's path (never the query string, where reset links keep their token).

const reported = new Set<string>();
const MAX_PER_PAGE_LOAD = 10;

/** Not crashes: the server already knows about its own errors, and being offline isn't a bug. */
function expected(err: Error): boolean {
  if (err instanceof ApiError) return true;
  return /Failed to fetch|NetworkError|Load failed|ResizeObserver loop/.test(err.message);
}

export function reportCrash(error: unknown): void {
  if (__DEV__) return;
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Something non-Error was thrown');
  if (expected(err)) return;
  const key = `${err.name}:${err.message}`;
  if (reported.has(key) || reported.size >= MAX_PER_PAGE_LOAD) return;
  reported.add(key);
  const page = Platform.OS === 'web' && typeof location !== 'undefined' ? location.pathname : '/';
  void fetch(`${API_URL}/api/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: (err.name || 'Error').slice(0, 100), message: err.message.slice(0, 1000), stack: err.stack?.slice(0, 10_000), page: page.slice(0, 300) }),
    credentials: 'omit',
    // Still delivered if the page is closing.
    keepalive: true,
  }).catch(() => {});
}

/** On the web: errors nothing caught, anywhere in the page. (Native gets its handler with the iOS app.) */
export function installCrashReporting(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.addEventListener('error', (event) => reportCrash(event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => reportCrash(event.reason));
}
