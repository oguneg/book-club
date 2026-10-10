import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { parsePending, type PendingLog } from './pending';

// Waiting logs survive closing the app: in the browser's storage on the web, a small file on phones. One
// list per account, so someone else signing in on the same device never sends yours.

const name = (userId: string) => `bookclub-pending-progress-${userId.replace(/[^\w-]/g, '')}`;
const file = (userId: string) => new File(Paths.document, `${name(userId)}.json`);

export function loadPending(userId: string): PendingLog[] {
  try {
    if (Platform.OS === 'web') return parsePending(JSON.parse(globalThis.localStorage?.getItem(name(userId)) ?? '[]'));
    const f = file(userId);
    return f.exists ? parsePending(JSON.parse(f.textSync())) : [];
  } catch {
    return [];
  }
}

export function savePending(userId: string, queue: readonly PendingLog[]): void {
  try {
    if (Platform.OS === 'web') {
      if (queue.length === 0) globalThis.localStorage?.removeItem(name(userId));
      else globalThis.localStorage?.setItem(name(userId), JSON.stringify(queue));
      return;
    }
    const f = file(userId);
    if (queue.length === 0) {
      if (f.exists) f.delete();
      return;
    }
    f.create({ overwrite: true });
    f.write(JSON.stringify(queue));
  } catch {
    // Storage full or unavailable: the queue still lives in memory until the app closes.
  }
}
