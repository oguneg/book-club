import { notificationSettings, notificationsResponse, type NotificationSettings } from '@bookclub/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

/** Your notifications, newest first, and how many are unread. The server says when there's news (live). */
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: ({ signal }) => apiGet('/api/notifications', notificationsResponse, signal),
  });
}

export function useUnreadCount(): number {
  return useNotifications().data?.unread ?? 0;
}

/** Marks these read, or all of them. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useCallback(
    async (ids?: string[]) => {
      await apiPost('/api/notifications/read', ids ? { ids } : {}, z.undefined());
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    [queryClient],
  );
}

const settingsResponse = z.object({ settings: notificationSettings });

/** What you've switched off; it follows you to every device. */
export function useNotificationSettings() {
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: async ({ signal }) => (await apiGet('/api/notifications/settings', settingsResponse, signal)).settings,
  });
}

/** Flips a switch at once, and back if the server says no. */
export function useChangeNotificationSettings() {
  const queryClient = useQueryClient();
  return async (change: Partial<NotificationSettings>) => {
    const before = queryClient.getQueryData<NotificationSettings>(['notification-settings']);
    if (before) queryClient.setQueryData(['notification-settings'], { ...before, ...change });
    try {
      queryClient.setQueryData(['notification-settings'], (await apiPut('/api/notifications/settings', change, settingsResponse)).settings);
    } catch (err) {
      if (before) queryClient.setQueryData(['notification-settings'], before);
      throw err;
    }
  };
}

/** This phone may be pushed to (signed in as you). */
export function registerDevice(input: { token: string; platform: 'ios' | 'android'; timeZone?: string }) {
  return apiPut('/api/notifications/devices', input, z.undefined());
}

/** This phone stops getting your pushes (signing out). */
export function forgetDevice(token: string) {
  return apiDelete(`/api/notifications/devices/${encodeURIComponent(token)}`, z.undefined());
}
