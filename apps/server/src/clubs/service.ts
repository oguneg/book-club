import { randomInt, randomUUID } from 'node:crypto';
import {
  bookKeyOf,
  CLUB_MEMBER_CAP,
  INVITE_ALPHABET,
  INVITE_LENGTH,
  roleAtLeast,
  type ClubBook,
  type ClubDetail,
  type ClubRole,
  type ClubSummary,
  type InvitePreview,
  type Meeting,
} from '@bookclub/shared';
import { and, asc, count, desc, eq, gt, inArray, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { createClubInput, meetingInput, setClubBookInput, updateClubBookInput, updateClubInput } from '@bookclub/shared';
import { toEdition } from '../books/service';
import type { Db } from '../db/client';
import { club, clubBook, clubMember, edition, meeting, user } from '../db/schema';

/** Clubs one person may own at once (spam guard). */
export const MAX_OWNED_CLUBS = 20;

export class ClubError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    readonly code: string,
  ) {
    super(code);
    this.name = 'ClubError';
  }
}

// Non-members get 404, never 403: a club's existence isn't revealed to outsiders.
const notFound = () => new ClubError(404, 'not_found');
const forbidden = () => new ClubError(403, 'forbidden');

function newInviteCode(): string {
  return Array.from({ length: INVITE_LENGTH }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');
}

const today = () => new Date().toISOString().slice(0, 10);

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === '23505' || e.cause?.code === '23505';
}

export function createClubService({ db }: { db: Db }) {
  async function roleOf(clubId: string, userId: string): Promise<ClubRole | null> {
    const [row] = await db
      .select({ role: clubMember.role })
      .from(clubMember)
      .where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, userId)));
    return row?.role ?? null;
  }

  /** The caller's role, or 404 for non-members and 403 when the role isn't enough. */
  async function requireRole(clubId: string, userId: string, needed: ClubRole): Promise<ClubRole> {
    const role = await roleOf(clubId, userId);
    if (!role) throw notFound();
    if (!roleAtLeast(role, needed)) throw forbidden();
    return role;
  }

  async function currentBook(clubId: string) {
    const [row] = await db
      .select()
      .from(clubBook)
      .where(and(eq(clubBook.clubId, clubId), eq(clubBook.status, 'current')));
    return row ?? null;
  }

  async function memberCount(clubId: string): Promise<number> {
    const [row] = await db.select({ n: count() }).from(clubMember).where(eq(clubMember.clubId, clubId));
    return row?.n ?? 0;
  }

  async function detail(clubId: string, userId: string): Promise<ClubDetail> {
    const [c] = await db.select().from(club).where(eq(club.id, clubId));
    const myRole = c ? await roleOf(clubId, userId) : null;
    if (!c || !myRole) throw notFound();

    const members = await db
      .select({ userId: clubMember.userId, name: user.name, image: user.image, role: clubMember.role, joinedAt: clubMember.joinedAt })
      .from(clubMember)
      .innerJoin(user, eq(user.id, clubMember.userId))
      .where(eq(clubMember.clubId, clubId))
      .orderBy(sql`case ${clubMember.role} when 'owner' then 0 when 'admin' then 1 else 2 end`, asc(clubMember.joinedAt));

    const books = await db
      .select({ book: clubBook, edition })
      .from(clubBook)
      .innerJoin(edition, eq(edition.id, clubBook.editionId))
      .where(eq(clubBook.clubId, clubId))
      .orderBy(desc(clubBook.startDate), desc(clubBook.createdAt));
    const meetings = books.length
      ? await db
          .select()
          .from(meeting)
          .where(inArray(meeting.clubBookId, books.map((b) => b.book.id)))
          .orderBy(asc(meeting.startsAt))
      : [];

    const toClubBook = ({ book, edition: e }: (typeof books)[number]): ClubBook => ({
      id: book.id,
      edition: toEdition(e),
      status: book.status,
      startDate: book.startDate,
      finishDate: book.finishDate,
      finishedAt: book.finishedAt?.toISOString() ?? null,
      meetings: meetings.filter((m) => m.clubBookId === book.id).map(toMeeting),
    });
    const current = books.find((b) => b.book.status === 'current');

    return {
      id: c.id,
      name: c.name,
      description: c.description,
      inviteCode: c.inviteCode,
      memberCap: c.memberCap,
      myRole,
      members: members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() })),
      currentBook: current ? toClubBook(current) : null,
      pastBooks: books.filter((b) => b.book.status === 'finished').map(toClubBook),
    };
  }

  function toMeeting(m: typeof meeting.$inferSelect): Meeting {
    return { id: m.id, startsAt: m.startsAt.toISOString(), title: m.title, location: m.location, readToPage: m.readToPage };
  }

  async function bookGlimpse(clubId: string) {
    const [row] = await db
      .select({ id: edition.id, workKey: edition.workKey, title: edition.title, authors: edition.authors, cover: edition.cover })
      .from(clubBook)
      .innerJoin(edition, eq(edition.id, clubBook.editionId))
      .where(and(eq(clubBook.clubId, clubId), eq(clubBook.status, 'current')));
    return row ? { title: row.title, authors: row.authors, cover: row.cover, bookKey: bookKeyOf(row) } : null;
  }

  async function meetingOfClub(clubId: string, meetingId: string) {
    const [row] = await db
      .select({ meeting })
      .from(meeting)
      .innerJoin(clubBook, eq(clubBook.id, meeting.clubBookId))
      .where(and(eq(meeting.id, meetingId), eq(clubBook.clubId, clubId)));
    if (!row) throw notFound();
    return row.meeting;
  }

  async function checkReadToPage(clubId: string, readToPage: number | null | undefined) {
    if (readToPage === null || readToPage === undefined) return;
    const book = await currentBook(clubId);
    const [e] = book ? await db.select({ pageCount: edition.pageCount }).from(edition).where(eq(edition.id, book.editionId)) : [];
    if (!e?.pageCount || readToPage > e.pageCount) throw new ClubError(400, 'page_out_of_range');
  }

  return {
    detail,

    async listForUser(userId: string): Promise<ClubSummary[]> {
      const rows = await db
        .select({ id: club.id, name: club.name, role: clubMember.role })
        .from(clubMember)
        .innerJoin(club, eq(club.id, clubMember.clubId))
        .where(eq(clubMember.userId, userId))
        .orderBy(asc(club.name));
      return Promise.all(
        rows.map(async (r) => {
          const [next] = await db
            .select({ startsAt: meeting.startsAt })
            .from(meeting)
            .innerJoin(clubBook, eq(clubBook.id, meeting.clubBookId))
            .where(and(eq(clubBook.clubId, r.id), eq(clubBook.status, 'current'), gt(meeting.startsAt, new Date())))
            .orderBy(asc(meeting.startsAt))
            .limit(1);
          return {
            ...r,
            memberCount: await memberCount(r.id),
            currentBook: await bookGlimpse(r.id),
            nextMeeting: next?.startsAt.toISOString() ?? null,
          };
        }),
      );
    },

    async create(userId: string, input: z.infer<typeof createClubInput>): Promise<ClubDetail> {
      const [owned] = await db
        .select({ n: count() })
        .from(clubMember)
        .where(and(eq(clubMember.userId, userId), eq(clubMember.role, 'owner')));
      if ((owned?.n ?? 0) >= MAX_OWNED_CLUBS) throw new ClubError(409, 'too_many_clubs');

      const id = randomUUID();
      for (let attempt = 0; ; attempt++) {
        try {
          await db.transaction(async (tx) => {
            await tx.insert(club).values({
              id,
              name: input.name,
              description: input.description || null,
              inviteCode: newInviteCode(),
              memberCap: CLUB_MEMBER_CAP,
              createdBy: userId,
            });
            await tx.insert(clubMember).values({ clubId: id, userId, role: 'owner' });
          });
          break;
        } catch (err) {
          // An invite code collision (one in billions) just gets a new code.
          if (!isUniqueViolation(err) || attempt >= 3) throw err;
        }
      }
      return detail(id, userId);
    },

    async update(clubId: string, userId: string, input: z.infer<typeof updateClubInput>) {
      await requireRole(clubId, userId, 'admin');
      const set: Partial<typeof club.$inferInsert> = {};
      if (input.name !== undefined) set.name = input.name;
      if (input.description !== undefined) set.description = input.description || null;
      if (Object.keys(set).length > 0) await db.update(club).set(set).where(eq(club.id, clubId));
      return detail(clubId, userId);
    },

    async remove(clubId: string, userId: string) {
      await requireRole(clubId, userId, 'owner');
      await db.delete(club).where(eq(club.id, clubId));
    },

    async rotateInvite(clubId: string, userId: string) {
      await requireRole(clubId, userId, 'admin');
      for (let attempt = 0; ; attempt++) {
        try {
          await db.update(club).set({ inviteCode: newInviteCode() }).where(eq(club.id, clubId));
          break;
        } catch (err) {
          if (!isUniqueViolation(err) || attempt >= 3) throw err;
        }
      }
      return detail(clubId, userId);
    },

    async previewInvite(code: string, userId: string | null): Promise<InvitePreview> {
      const [c] = await db.select().from(club).where(eq(club.inviteCode, code));
      if (!c) throw notFound();
      const members = await memberCount(c.id);
      return {
        code,
        club: { id: c.id, name: c.name, description: c.description, memberCount: members, currentBook: await bookGlimpse(c.id) },
        isMember: userId ? (await roleOf(c.id, userId)) !== null : false,
        isFull: members >= c.memberCap,
      };
    },

    async join(code: string, userId: string): Promise<{ clubId: string }> {
      const [c] = await db.select().from(club).where(eq(club.inviteCode, code));
      if (!c) throw notFound();
      if (await roleOf(c.id, userId)) return { clubId: c.id };
      if ((await memberCount(c.id)) >= c.memberCap) throw new ClubError(409, 'club_full');
      await db.insert(clubMember).values({ clubId: c.id, userId, role: 'member' }).onConflictDoNothing();
      return { clubId: c.id };
    },

    async leave(clubId: string, userId: string) {
      const role = await requireRole(clubId, userId, 'member');
      if (role === 'owner') throw new ClubError(409, 'owner_cannot_leave');
      await db.delete(clubMember).where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, userId)));
    },

    async setRole(clubId: string, actorId: string, targetId: string, role: 'admin' | 'member') {
      await requireRole(clubId, actorId, 'owner');
      const target = await roleOf(clubId, targetId);
      if (!target) throw notFound();
      if (target === 'owner') throw new ClubError(409, 'cannot_change_owner');
      await db.update(clubMember).set({ role }).where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, targetId)));
      return detail(clubId, actorId);
    },

    async removeMember(clubId: string, actorId: string, targetId: string) {
      const actor = await requireRole(clubId, actorId, 'admin');
      const target = await roleOf(clubId, targetId);
      if (!target) throw notFound();
      // Owners remove anyone but themselves; admins remove regular members only.
      if (target === 'owner' || (actor === 'admin' && target !== 'member')) throw forbidden();
      await db.delete(clubMember).where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, targetId)));
      return detail(clubId, actorId);
    },

    async transferOwnership(clubId: string, actorId: string, targetId: string) {
      await requireRole(clubId, actorId, 'owner');
      if (targetId === actorId) throw new ClubError(400, 'already_owner');
      if (!(await roleOf(clubId, targetId))) throw notFound();
      await db.transaction(async (tx) => {
        // Demote first: the one-owner index would reject two owners even for a moment.
        await tx.update(clubMember).set({ role: 'admin' }).where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, actorId)));
        await tx.update(clubMember).set({ role: 'owner' }).where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, targetId)));
      });
      return detail(clubId, actorId);
    },

    /** Sets the current book, or switches the current book to another edition/book. */
    async setBook(clubId: string, userId: string, input: z.infer<typeof setClubBookInput>) {
      await requireRole(clubId, userId, 'admin');
      const [e] = await db.select().from(edition).where(eq(edition.id, input.editionId));
      if (!e) throw new ClubError(400, 'unknown_edition');
      if (!e.pageCount) throw new ClubError(400, 'edition_without_pages');
      const existing = await currentBook(clubId);
      if (existing) {
        await db
          .update(clubBook)
          .set({
            editionId: e.id,
            ...(input.startDate ? { startDate: input.startDate } : {}),
            ...(input.finishDate !== undefined ? { finishDate: input.finishDate } : {}),
          })
          .where(eq(clubBook.id, existing.id));
        // "Read to page N" was in the old edition's numbering; drop targets beyond the new one's last page.
        await db
          .update(meeting)
          .set({ readToPage: null })
          .where(and(eq(meeting.clubBookId, existing.id), gt(meeting.readToPage, e.pageCount)));
      } else {
        await db.insert(clubBook).values({
          id: randomUUID(),
          clubId,
          editionId: e.id,
          status: 'current',
          startDate: input.startDate ?? today(),
          finishDate: input.finishDate ?? null,
        });
      }
      return detail(clubId, userId);
    },

    async updateBook(clubId: string, userId: string, input: z.infer<typeof updateClubBookInput>) {
      await requireRole(clubId, userId, 'admin');
      const book = await currentBook(clubId);
      if (!book) throw new ClubError(409, 'no_current_book');
      const startDate = input.startDate ?? book.startDate;
      const finishDate = input.finishDate !== undefined ? input.finishDate : book.finishDate;
      if (finishDate && finishDate < startDate) throw new ClubError(400, 'finish_before_start');
      await db.update(clubBook).set({ startDate, finishDate }).where(eq(clubBook.id, book.id));
      return detail(clubId, userId);
    },

    async finishBook(clubId: string, userId: string) {
      await requireRole(clubId, userId, 'admin');
      const book = await currentBook(clubId);
      if (!book) throw new ClubError(409, 'no_current_book');
      await db.update(clubBook).set({ status: 'finished', finishedAt: new Date() }).where(eq(clubBook.id, book.id));
      return detail(clubId, userId);
    },

    async addMeeting(clubId: string, userId: string, input: z.infer<typeof meetingInput>) {
      await requireRole(clubId, userId, 'admin');
      const book = await currentBook(clubId);
      if (!book) throw new ClubError(409, 'no_current_book');
      await checkReadToPage(clubId, input.readToPage);
      await db.insert(meeting).values({
        id: randomUUID(),
        clubBookId: book.id,
        startsAt: new Date(input.startsAt),
        title: input.title,
        location: input.location || null,
        readToPage: input.readToPage ?? null,
      });
      return detail(clubId, userId);
    },

    async updateMeeting(clubId: string, userId: string, meetingId: string, input: z.infer<typeof meetingInput>) {
      await requireRole(clubId, userId, 'admin');
      await meetingOfClub(clubId, meetingId);
      await checkReadToPage(clubId, input.readToPage);
      await db
        .update(meeting)
        .set({ startsAt: new Date(input.startsAt), title: input.title, location: input.location || null, readToPage: input.readToPage ?? null })
        .where(eq(meeting.id, meetingId));
      return detail(clubId, userId);
    },

    async deleteMeeting(clubId: string, userId: string, meetingId: string) {
      await requireRole(clubId, userId, 'admin');
      await meetingOfClub(clubId, meetingId);
      await db.delete(meeting).where(eq(meeting.id, meetingId));
      return detail(clubId, userId);
    },

    /**
     * Before an account is deleted: hand each club it owns to the longest-standing admin, else the
     * longest-standing member; a club with nobody else in it is deleted. Memberships go with the user.
     */
    async releaseClubsOf(userId: string) {
      const owned = await db
        .select({ clubId: clubMember.clubId })
        .from(clubMember)
        .where(and(eq(clubMember.userId, userId), eq(clubMember.role, 'owner')));
      for (const { clubId } of owned) {
        const [heir] = await db
          .select({ userId: clubMember.userId })
          .from(clubMember)
          .where(and(eq(clubMember.clubId, clubId), ne(clubMember.userId, userId)))
          .orderBy(sql`case ${clubMember.role} when 'admin' then 0 else 1 end`, asc(clubMember.joinedAt))
          .limit(1);
        if (!heir) {
          await db.delete(club).where(eq(club.id, clubId));
          continue;
        }
        await db.transaction(async (tx) => {
          await tx.delete(clubMember).where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, userId)));
          await tx.update(clubMember).set({ role: 'owner' }).where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, heir.userId)));
        });
      }
    },
  };
}

export type ClubService = ReturnType<typeof createClubService>;
