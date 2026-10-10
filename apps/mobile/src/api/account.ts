import { useQuery } from '@tanstack/react-query';
import { File as FsFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { authClient, sessionHeaders } from '@/auth/client';
import { API_URL } from '@/config';
import { ApiError } from './client';

/** The signed-in user's ways of signing in, by provider ("credential" is the password), with their row ids. */
export function useSignInMethods() {
  return useQuery({
    queryKey: ['account', 'methods'],
    queryFn: async () => {
      const result = await authClient.listAccounts();
      if (result.error) throw new ApiError(result.error.status, result.error.message ?? 'listAccounts failed');
      return new Map(result.data.map((a) => [a.providerId, a.id]));
    },
  });
}

/** How many devices (sessions) the user is signed in on. */
export function useDeviceCount() {
  return useQuery({
    queryKey: ['account', 'devices'],
    queryFn: async () => {
      const result = await authClient.listSessions();
      if (result.error) throw new ApiError(result.error.status, result.error.message ?? 'listSessions failed');
      return result.data.length;
    },
  });
}

/** Saves the data export as a file: a download on the web, the share sheet on phones (Files, Mail, AirDrop). */
export async function downloadMyData(): Promise<void> {
  const res = await fetch(`${API_URL}/api/account/export`, {
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
    headers: await sessionHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, `export failed with ${res.status}`, body.error);
  }
  const named = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'bookclub-data.json';
  const filename = named.replace(/[^\w.-]/g, '-');
  if (Platform.OS !== 'web') {
    const file = new FsFile(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(await res.text());
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: filename });
    return;
  }
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
