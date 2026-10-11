import { randomUUID } from 'node:crypto';
import {
  pageToPosition,
  positionToPage,
  TOPIC_OF,
  type NotificationItem,
  type NotificationKind,
  type NotificationSettings,
  type NotificationTopic,
} from '@bookclub/shared';
import { and, count, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { Db } from '../db/client';
import { club, clubBook, clubMember, edition, meeting, notification, notificationSetting, pushToken, reading, user, userBlock } from '../db/schema';
import type { LiveHub } from '../live';
import type { PushMessage, PushSender } from './push';

// Who hears about what, and how: a row per person for the bell's list, and a push to their phones. Pushes
// carry no note text at all (spoilers are opt-in), only who, which club and book, and when.

const ALL_ON: NotificationSettings = { replies: true, meetings: true, notes: true, club: true };
/** A meeting's reminder goes out the day before. */
const REMIND_WITHIN_MS = 24 * 60 * 60 * 1000;
/** ...unless it was set or moved in the last hour: that news has just gone out. */
const JUST_SET_MS = 60 * 60 * 1000;
const LIST_LIMIT = 50;

/** What a notification shows, as it was when it happened. */
interface Data {
  bookTitle?: string;
  /** A reply: the page of your note, in your edition. */
  page?: number | null;
  meeting?: { startsAt: string; title: string; readToPage: number | null; moved: boolean };
  url: string | null;
}

interface Draft {
  userId: string;
  kind: NotificationKind;
  actorId: string | null;
  clubId: string | null;
  bookKey?: string;
  data: Data;
  dedupeKey?: string;
  /** The pushed text, in the phone's time zone. */
  push: (timeZone: string | undefined) => { title: string; body: string };
}

interface Reader {
  id: string;
  userId: string;
  title: string;
  startPage: number;
  endPage: number;
}

/** "Thu 14 Oct, 19:00" in a time zone (the server's own when the phone didn't say). */
export function formatWhen(at: Date, timeZone: string | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(at);
  }
}

/** "today at 19:00" or "tomorrow at 19:00" (a reminder is never further off than that). */
export function formatSoon(at: Date, now: Date, timeZone: string | undefined): string {
  const day = (d: Date) => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
    } catch {
      return new Intl.DateTimeFormat('en-CA').format(d);
    }
  };
  let time: string;
  try {
    time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(at);
  } catch {
    time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(at);
  }
  return `${day(at) === day(now) ? 'today' : 'tomorrow'} at ${time}`;
}

/** A meeting's page (in the club's edition) in a reader's own copy. */
function pageFor(clubPage: number | null, clubPages: number | null, r: Pick<Reader, 'startPage' | 'endPage'> | undefined): number | null {
  if (clubPage === null || !clubPages || !r) return null;
  return positionToPage(pageToPosition(Math.min(clubPage, clubPages), { startPage: 1, endPage: Math.max(clubPages, 2) }), r);
}

export function createNotificationService({ db, live, push, log }: { db: Db; live?: LiveHub; push?: PushSender; log: Logger }) {
  async function settingsOf(userIds: string[]): Promise<Map<string, NotificationSettings>> {
    if (userIds.length === 0) return new Map();
    const rows = await db.select().from(notificationSetting).where(inArray(notificationSetting.userId, userIds));
    return new Map(rows.map((r) => [r.userId, { replies: r.replies, meetings: r.meetings, notes: r.notes, club: r.club }]));
  }

  async function unreadOf(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const rows = await db
      .select({ userId: notification.userId, n: count() })
      .from(notification)
      .where(and(inArray(notification.userId, userIds), isNull(notification.readAt)))
      .groupBy(notification.userId);
    return new Map(rows.map((r) => [r.userId, Number(r.n)]));
  }

  /** People who blocked someone, or whom they blocked: they never hear about each other. */
  async function blockedWith(userId: string): Promise<Set<string>> {
    const rows = await db
      .select({ blocker: userBlock.blockerId, blocked: userBlock.blockedId })
      .from(userBlock)
      .where(or(eq(userBlock.blockerId, userId), eq(userBlock.blockedId, userId)));
    return new Set(rows.map((r) => (r.blocker === userId ? r.blocked : r.blocker)));
  }

  /** A club's members, but not the one who did it nor anyone blocked either way. */
  async function audience(clubId: string, actorId: string | null): Promise<string[]> {
    const members = await db.select({ userId: clubMember.userId }).from(clubMember).where(eq(clubMember.clubId, clubId));
    const blocked = actorId ? await blockedWith(actorId) : new Set<string>();
    return members.map((m) => m.userId).filter((id) => id !== actorId && !blocked.has(id));
  }

  async function settings(userId: string): Promise<NotificationSettings> {
    return (await settingsOf([userId])).get(userId) ?? ALL_ON;
  }

  async function nameOf(userId: string): Promise<string> {
    const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
    return row?.name ?? 'Someone';
  }

  /** A club and its current book: the reference edition (meeting pages are in it) and which book it is. */
  async function clubInfo(clubId: string) {
    const [row] = await db
      .select({
        name: club.name,
        clubBookId: clubBook.id,
        title: edition.title,
        pageCount: edition.pageCount,
        bookKey: sql<string | null>`case when ${edition.workKey} is not null then 'w:' || ${edition.workKey} else 'e:' || ${edition.id} end`,
      })
      .from(club)
      .leftJoin(clubBook, and(eq(clubBook.clubId, club.id), eq(clubBook.status, 'current')))
      .leftJoin(edition, eq(edition.id, clubBook.editionId))
      .where(eq(club.id, clubId));
    return row ?? null;
  }

  /** Each person's own copy of a book (the reading they're in, else the latest), with its title. */
  async function readersOf(userIds: string[], bookKey: string): Promise<Map<string, Reader & { position: number; status: string }>> {
    if (userIds.length === 0) return new Map();
    const rows = await db
      .select({
        id: reading.id,
        userId: reading.userId,
        title: edition.title,
        startPage: reading.startPage,
        endPage: reading.endPage,
        position: reading.position,
        status: reading.status,
      })
      .from(reading)
      .innerJoin(edition, eq(edition.id, reading.editionId))
      .where(and(eq(reading.bookKey, bookKey), inArray(reading.userId, userIds)))
      .orderBy(sql`${reading.status} = 'reading' desc`, desc(reading.updatedAt));
    const byUser = new Map<string, Reader & { position: number; status: string }>();
    for (const r of rows) if (!byUser.has(r.userId)) byUser.set(r.userId, r);
    return byUser;
  }

  async function sendPushes(drafts: Draft[]) {
    if (!push || drafts.length === 0) return;
    const userIds = [...new Set(drafts.map((d) => d.userId))];
    const tokens = await db.select().from(pushToken).where(inArray(pushToken.userId, userIds));
    if (tokens.length === 0) return;
    const unread = await unreadOf(userIds);
    const messages: PushMessage[] = drafts.flatMap((d) =>
      tokens
        .filter((t) => t.userId === d.userId)
        .map((t) => ({ to: t.token, ...d.push(t.timeZone ?? undefined), data: { url: d.data.url }, badge: unread.get(d.userId) ?? 0, sound: 'default' as const })),
    );
    const { deadTokens } = await push(messages);
    if (deadTokens.length > 0) await db.delete(pushToken).where(inArray(pushToken.token, deadTokens));
  }

  /**
   * Stores and pushes, for the people who haven't switched that topic off. A clubmate's note joins the unread
   * bundle for that club and book (counted, not pushed again); a once-only one (a reminder) goes out once.
   */
  async function deliver(drafts: Draft[]) {
    if (drafts.length === 0) return;
    const settings = await settingsOf([...new Set(drafts.map((d) => d.userId))]);
    const wanted = drafts.filter((d) => (settings.get(d.userId) ?? ALL_ON)[TOPIC_OF[d.kind]]);
    const fresh: Draft[] = [];
    for (const d of wanted) {
      if (d.kind === 'notes' && d.clubId && d.bookKey) {
        const [open] = await db
          .select({ id: notification.id })
          .from(notification)
          .where(and(eq(notification.userId, d.userId), eq(notification.kind, 'notes'), eq(notification.clubId, d.clubId), eq(notification.bookKey, d.bookKey), isNull(notification.readAt)));
        if (open) {
          await db
            .update(notification)
            .set({ count: sql`${notification.count} + 1`, actorId: d.actorId, data: d.data })
            .where(eq(notification.id, open.id));
          continue;
        }
      }
      const inserted = await db
        .insert(notification)
        .values({ id: randomUUID(), userId: d.userId, kind: d.kind, actorId: d.actorId, clubId: d.clubId, bookKey: d.bookKey ?? null, data: d.data, dedupeKey: d.dedupeKey ?? null })
        .onConflictDoNothing()
        .returning({ id: notification.id });
      if (inserted.length > 0) fresh.push(d);
    }
    live?.notificationsChanged(wanted.map((d) => d.userId));
    await sendPushes(fresh).catch((err: unknown) => log.warn({ err }, 'push failed'));
  }

  /** Never lets a notification break what caused it. */
  const quietly =
    <A extends unknown[]>(what: string, fn: (...args: A) => Promise<void>) =>
    async (...args: A) => {
      try {
        await fn(...args);
      } catch (err) {
        log.error({ err }, `notifying failed: ${what}`);
      }
    };

  return {
    // ---- What happened ----

    /** Someone replied to a note: its author hears, on their own note's page. */
    replied: quietly('reply', async (replierId: string, parent: { userId: string; bookKey: string; editionId: string; page: number | null; clubId: string | null }) => {
      if (parent.userId === replierId || (await blockedWith(replierId)).has(parent.userId)) return;
      const own = (await readersOf([parent.userId], parent.bookKey)).get(parent.userId);
      const [noted] = own ? [] : await db.select({ title: edition.title }).from(edition).where(eq(edition.id, parent.editionId));
      const title = own?.title ?? noted?.title ?? 'a book';
      const name = await nameOf(replierId);
      await deliver([
        {
          userId: parent.userId,
          kind: 'reply',
          actorId: replierId,
          clubId: parent.clubId,
          data: { bookTitle: title, page: parent.page, url: own ? `/readings/${own.id}` : parent.clubId ? `/clubs/${parent.clubId}` : null },
          push: () => ({ title: `${name} replied to your note`, body: parent.page ? `${title}, p. ${parent.page}` : title }),
        },
      ]);
    }),

    /** A club note: members who've already reached its place can read it (bundled per club and book). */
    clubNote: quietly('club note', async (authorId: string, n: { bookKey: string; position: number; clubId: string }) => {
      const people = await audience(n.clubId, authorId);
      const readers = [...(await readersOf(people, n.bookKey)).values()].filter((r) => r.status !== 'stopped' && r.position >= n.position);
      if (readers.length === 0) return;
      const info = await clubInfo(n.clubId);
      const name = await nameOf(authorId);
      await deliver(
        readers.map((r) => ({
          userId: r.userId,
          kind: 'notes' as const,
          actorId: authorId,
          clubId: n.clubId,
          bookKey: n.bookKey,
          data: { bookTitle: r.title, url: `/readings/${r.id}` },
          push: () => ({ title: info?.name ?? 'Your club', body: `${name} left a note in ${r.title}, on a page you've read` }),
        })),
      );
    }),

    joined: quietly('joined', async (clubId: string, userId: string) => {
      const info = await clubInfo(clubId);
      const name = await nameOf(userId);
      await deliver(
        (await audience(clubId, userId)).map((id) => ({
          userId: id,
          kind: 'joined' as const,
          actorId: userId,
          clubId,
          data: { url: `/clubs/${clubId}` },
          push: () => ({ title: info?.name ?? 'Your club', body: `${name} joined` }),
        })),
      );
    }),

    bookChosen: quietly('book chosen', async (clubId: string, actorId: string) => {
      const info = await clubInfo(clubId);
      if (!info?.title) return;
      const name = await nameOf(actorId);
      await deliver(
        (await audience(clubId, actorId)).map((id) => ({
          userId: id,
          kind: 'book-chosen' as const,
          actorId,
          clubId,
          data: { bookTitle: info.title!, url: `/clubs/${clubId}` },
          push: () => ({ title: info.name, body: `Next up: ${info.title}, chosen by ${name}` }),
        })),
      );
    }),

    /** A meeting set, or moved to another time (a new title or place alone isn't news). */
    meetingSet: quietly('meeting set', async (clubId: string, meetingId: string, actorId: string, moved: boolean) => {
      const [m] = await db.select().from(meeting).where(eq(meeting.id, meetingId));
      const info = await clubInfo(clubId);
      if (!m || !info) return;
      const people = await audience(clubId, actorId);
      const readers = info.bookKey ? await readersOf(people, info.bookKey) : new Map();
      await deliver(
        people.map((id) => {
          const readToPage = pageFor(m.readToPage, info.pageCount, readers.get(id));
          return {
            userId: id,
            kind: 'meeting-set' as const,
            actorId,
            clubId,
            data: { meeting: { startsAt: m.startsAt.toISOString(), title: m.title, readToPage, moved }, url: `/clubs/${clubId}` },
            push: (tz: string | undefined) => ({
              title: info.name,
              body: `${moved ? 'Meeting moved to' : 'New meeting:'} ${formatWhen(m.startsAt, tz)}${readToPage ? ` · read up to p. ${readToPage}` : ''}`,
            }),
          };
        }),
      );
    }),

    /** Someone finished a book their club is reading. */
    finished: quietly('finished', async (userId: string, bookKey: string) => {
      const clubs = await db
        .select({ clubId: clubBook.clubId })
        .from(clubBook)
        .innerJoin(edition, eq(edition.id, clubBook.editionId))
        .innerJoin(clubMember, and(eq(clubMember.clubId, clubBook.clubId), eq(clubMember.userId, userId)))
        .where(and(eq(clubBook.status, 'current'), sql`case when ${edition.workKey} is not null then 'w:' || ${edition.workKey} else 'e:' || ${edition.id} end = ${bookKey}`));
      const name = await nameOf(userId);
      for (const { clubId } of clubs) {
        const info = await clubInfo(clubId);
        if (!info?.title) continue;
        await deliver(
          (await audience(clubId, userId)).map((id) => ({
            userId: id,
            kind: 'finished' as const,
            actorId: userId,
            clubId,
            data: { bookTitle: info.title!, url: `/clubs/${clubId}` },
            push: () => ({ title: info.name, body: `${name} finished ${info.title}` }),
          })),
        );
      }
    }),

    /** The day before a meeting: where to read up to, in each member's own pages. Run every few minutes. */
    async remindMeetings(now = new Date()) {
      const due = await db
        .select({ id: meeting.id, startsAt: meeting.startsAt, title: meeting.title, readToPage: meeting.readToPage, clubId: clubBook.clubId })
        .from(meeting)
        .innerJoin(clubBook, and(eq(clubBook.id, meeting.clubBookId), eq(clubBook.status, 'current')))
        .where(
          and(
            gt(meeting.startsAt, now),
            lte(meeting.startsAt, new Date(now.getTime() + REMIND_WITHIN_MS)),
            lte(meeting.updatedAt, new Date(now.getTime() - JUST_SET_MS)),
          ),
        );
      for (const m of due) {
        const info = await clubInfo(m.clubId);
        if (!info) continue;
        const people = await audience(m.clubId, null);
        const readers = info.bookKey ? await readersOf(people, info.bookKey) : new Map();
        await deliver(
          people.map((id) => {
            const readToPage = pageFor(m.readToPage, info.pageCount, readers.get(id));
            return {
              userId: id,
              kind: 'meeting-soon' as const,
              actorId: null,
              clubId: m.clubId,
              dedupeKey: `meeting:${m.id}:${m.startsAt.toISOString()}`,
              data: { meeting: { startsAt: m.startsAt.toISOString(), title: m.title, readToPage, moved: false }, url: `/clubs/${m.clubId}` },
              push: (tz: string | undefined) => ({
                title: `${info.name} meets ${formatSoon(m.startsAt, now, tz)}`,
                body: [m.title, readToPage ? `read up to p. ${readToPage}` : null].filter(Boolean).join(' · '),
              }),
            };
          }),
        );
      }
      return due.length;
    },

    // ---- The bell ----

    async list(userId: string): Promise<{ items: NotificationItem[]; unread: number }> {
      const rows = await db
        .select({ n: notification, club: { id: club.id, name: club.name }, person: { id: user.id, name: user.name, image: user.image } })
        .from(notification)
        .leftJoin(club, eq(club.id, notification.clubId))
        .leftJoin(user, eq(user.id, notification.actorId))
        .where(eq(notification.userId, userId))
        .orderBy(desc(notification.updatedAt))
        .limit(LIST_LIMIT);
      const unread = (await unreadOf([userId])).get(userId) ?? 0;
      return {
        unread,
        items: rows.map(({ n, club: c, person }) => {
          const data = n.data as Data;
          return {
            id: n.id,
            kind: n.kind,
            at: n.updatedAt.toISOString(),
            read: n.readAt !== null,
            count: n.count,
            person: person?.id ? { id: person.id, name: person.name!, image: person.image ?? null } : null,
            club: c?.id ? { id: c.id, name: c.name! } : null,
            book: data.bookTitle ? { title: data.bookTitle } : null,
            page: data.page ?? null,
            meeting: data.meeting ?? null,
            url: data.url ?? null,
          };
        }),
      };
    },

    async markRead(userId: string, ids?: string[]) {
      const scope = ids ? and(eq(notification.userId, userId), inArray(notification.id, ids)) : eq(notification.userId, userId);
      await db
        .update(notification)
        // Reading it isn't news: keep its time (and place in the list).
        .set({ readAt: new Date(), updatedAt: sql`${notification.updatedAt}` })
        .where(and(scope, isNull(notification.readAt)));
      live?.notificationsChanged([userId]);
    },

    // ---- Settings and phones ----

    settings,

    async updateSettings(userId: string, change: Partial<Record<NotificationTopic, boolean>>): Promise<NotificationSettings> {
      const next = { ...(await settings(userId)), ...change };
      await db.insert(notificationSetting).values({ userId, ...next }).onConflictDoUpdate({ target: notificationSetting.userId, set: next });
      live?.notificationsChanged([userId]);
      return next;
    },

    /** A phone allowed notifications: it's this person's now (a shared phone moves to whoever signed in). */
    async addToken(userId: string, input: { token: string; platform: 'ios' | 'android'; timeZone?: string }) {
      await db
        .insert(pushToken)
        .values({ token: input.token, userId, platform: input.platform, timeZone: input.timeZone ?? null })
        .onConflictDoUpdate({ target: pushToken.token, set: { userId, platform: input.platform, timeZone: input.timeZone ?? null, updatedAt: new Date() } });
    },

    /** Signing out on a phone stops its pushes. */
    async removeToken(userId: string, token: string) {
      await db.delete(pushToken).where(and(eq(pushToken.token, token), eq(pushToken.userId, userId)));
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
/** What the club, reading and note services report as it happens (each call never throws). */
export type NotificationEvents = Pick<NotificationService, 'replied' | 'clubNote' | 'joined' | 'bookChosen' | 'meetingSet' | 'finished'>;
