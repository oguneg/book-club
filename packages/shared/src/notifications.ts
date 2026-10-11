import { z } from 'zod';

// Notifications: pushed to phones, and listed in the app under the bell everywhere. Few and useful, each
// topic can be switched off, and none ever carries text from past where you are in a book.

/** What a person can switch off. */
export const NOTIFICATION_TOPICS = ['replies', 'meetings', 'notes', 'club'] as const;
export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];

export const notificationSettings = z.object({
  /** Someone replied to your note. */
  replies: z.boolean(),
  /** A meeting is tomorrow. */
  meetings: z.boolean(),
  /** Clubmates left notes on pages you've reached (bundled per club and book). */
  notes: z.boolean(),
  /** Club news: a new book, a meeting set or moved, someone finished or joined. */
  club: z.boolean(),
});
export type NotificationSettings = z.infer<typeof notificationSettings>;
export const updateNotificationSettingsInput = notificationSettings.partial();

export const NOTIFICATION_KINDS = ['reply', 'notes', 'meeting-soon', 'meeting-set', 'finished', 'book-chosen', 'joined'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Which switch a kind of notification answers to. */
export const TOPIC_OF: Record<NotificationKind, NotificationTopic> = {
  reply: 'replies',
  notes: 'notes',
  'meeting-soon': 'meetings',
  'meeting-set': 'club',
  finished: 'club',
  'book-chosen': 'club',
  joined: 'club',
};

export const notificationItem = z.object({
  id: z.string(),
  kind: z.enum(NOTIFICATION_KINDS),
  /** ISO time of the latest thing it's about. */
  at: z.string(),
  read: z.boolean(),
  /** How many it bundles (clubmates' notes); 1 otherwise. */
  count: z.number().int(),
  /** Who did it (the latest, for a bundle). */
  person: z.object({ id: z.string(), name: z.string(), image: z.string().nullable() }).nullable(),
  club: z.object({ id: z.string(), name: z.string() }).nullable(),
  book: z.object({ title: z.string() }).nullable(),
  /** A reply: the page of your note, in your edition. */
  page: z.number().int().nullable(),
  meeting: z
    .object({
      startsAt: z.string(),
      title: z.string(),
      /** In your own edition's pages; null when the meeting has no page or you aren't reading the book. */
      readToPage: z.number().int().nullable(),
      moved: z.boolean(),
    })
    .nullable(),
  /** Where a tap goes in the app ("/readings/…", "/clubs/…"). */
  url: z.string().nullable(),
});
export type NotificationItem = z.infer<typeof notificationItem>;

export const notificationsResponse = z.object({ items: z.array(notificationItem), unread: z.number().int() });

/** Mark these read, or everything when `ids` is left out. */
export const markNotificationsReadInput = z.object({ ids: z.array(z.string()).max(200).optional() });

/** A phone's Expo push token, sent when notifications are allowed on it. */
export const pushTokenInput = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/),
  platform: z.enum(['ios', 'android']),
  /** IANA time zone, so a pushed "tomorrow at 19:00" is in the phone's own time. */
  timeZone: z.string().max(64).optional(),
});
