import { randomUUID } from 'node:crypto';
import {
  pageToPosition,
  percentToPosition,
  REACTIONS,
  REPORTS_TO_HIDE,
  roleAtLeast,
  type Note,
  type NoteReply,
  type NoteViewer,
  type ReportedNote,
} from '@bookclub/shared';
import { and, asc, count, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { createNoteInput, reportInput } from '@bookclub/shared';
import type { Db } from '../db/client';
import { club, clubBook, clubMember, edition, note, noteReaction, noteReport, reading, user, userBlock } from '../db/schema';
import type { LiveHub } from '../live';

export class NoteError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    readonly code: string,
  ) {
    super(code);
    this.name = 'NoteError';
  }
}

const notFound = () => new NoteError(404, 'not_found');
type NoteRow = typeof note.$inferSelect;
export type NoteScope = 'all' | 'public' | 'mine' | `club:${string}`;

export function createNoteService({
  db,
  live,
  onHidden,
}: {
  db: Db;
  live?: LiveHub;
  /** A public note just reached enough reports to be hidden: tell the moderators. */
  onHidden?: (noteId: string) => void;
}) {
  /** The viewer's latest reading of this book: their place (for spoilers) and their edition (for page numbers). */
  async function viewerOf(userId: string, bookKey: string): Promise<NoteViewer | null> {
    const [r] = await db
      .select()
      .from(reading)
      .where(and(eq(reading.userId, userId), eq(reading.bookKey, bookKey)))
      .orderBy(sql`case ${reading.status} when 'reading' then 0 else 1 end`, desc(reading.startedAt))
      .limit(1);
    return r ? { position: r.position, editionId: r.editionId, startPage: r.startPage, endPage: r.endPage } : null;
  }

  async function myClubs(userId: string) {
    const rows = await db.select({ clubId: clubMember.clubId, role: clubMember.role }).from(clubMember).where(eq(clubMember.userId, userId));
    return new Map(rows.map((r) => [r.clubId, r.role]));
  }

  /** People hidden from the viewer: those they blocked and those who blocked them. */
  async function blockedWith(userId: string): Promise<Set<string>> {
    const rows = await db
      .select({ a: userBlock.blockerId, b: userBlock.blockedId })
      .from(userBlock)
      .where(or(eq(userBlock.blockerId, userId), eq(userBlock.blockedId, userId)));
    return new Set(rows.map((r) => (r.a === userId ? r.b : r.a)));
  }

  /** Whether the viewer may see this note (replies follow their parent). */
  async function canSee(userId: string, row: NoteRow): Promise<boolean> {
    const top = row.parentId ? (await db.select().from(note).where(eq(note.id, row.parentId)))[0] : row;
    if (!top) return false;
    const blocked = await blockedWith(userId);
    if (blocked.has(row.userId) || blocked.has(top.userId)) return false;
    if (top.userId === userId || top.visibility === 'public') return true;
    if (top.visibility === 'club' && top.clubId) return (await myClubs(userId)).has(top.clubId);
    return false;
  }

  async function loadVisible(id: string, userId: string): Promise<NoteRow> {
    const [row] = await db.select().from(note).where(eq(note.id, id));
    if (!row || !(await canSee(userId, row))) throw notFound();
    return row;
  }

  async function announce(row: Pick<NoteRow, 'userId' | 'bookKey' | 'visibility' | 'clubId'>) {
    if (!live) return;
    await live.notesChanged(row).catch(() => {});
  }

  /** Deletes a note or reply; a note with replies stays as a "deleted" placeholder. Returns its thread's note. */
  async function deleteNote(row: NoteRow): Promise<NoteRow> {
    const top = row.parentId ? ((await db.select().from(note).where(eq(note.id, row.parentId)))[0] ?? row) : row;
    const [replies] = row.parentId ? [{ n: 0 }] : await db.select({ n: count() }).from(note).where(and(eq(note.parentId, row.id), isNull(note.deletedAt)));
    if ((replies?.n ?? 0) > 0) {
      await db.update(note).set({ body: null, deletedAt: new Date() }).where(eq(note.id, row.id));
      await db.delete(noteReaction).where(eq(noteReaction.noteId, row.id));
    } else {
      await db.delete(note).where(eq(note.id, row.id));
    }
    return top;
  }

  return {
    async list(userId: string, bookKey: string, scope: NoteScope = 'all'): Promise<{ viewer: NoteViewer | null; notes: Note[] }> {
      const [viewer, clubs, blocked] = await Promise.all([viewerOf(userId, bookKey), myClubs(userId), blockedWith(userId)]);
      const clubIds = [...clubs.keys()];

      const visible = or(
        eq(note.userId, userId),
        eq(note.visibility, 'public'),
        clubIds.length ? and(eq(note.visibility, 'club'), inArray(note.clubId, clubIds)) : sql`false`,
      );
      const scoped =
        scope === 'public'
          ? eq(note.visibility, 'public')
          : scope === 'mine'
            ? eq(note.userId, userId)
            : scope.startsWith('club:')
              ? and(eq(note.visibility, 'club'), eq(note.clubId, scope.slice(5)))
              : undefined;

      const top = await db
        .select({ note, authorName: user.name, clubName: club.name })
        .from(note)
        .innerJoin(user, eq(user.id, note.userId))
        .leftJoin(club, eq(club.id, note.clubId))
        .where(and(eq(note.bookKey, bookKey), isNull(note.parentId), visible, scoped))
        .orderBy(asc(note.position), asc(note.createdAt))
        .limit(500);

      const ids = top.map((t) => t.note.id);
      const replies = ids.length
        ? await db
            .select({ note, authorName: user.name })
            .from(note)
            .innerJoin(user, eq(user.id, note.userId))
            .where(and(inArray(note.parentId, ids), isNull(note.deletedAt)))
            .orderBy(asc(note.createdAt))
        : [];
      const allIds = [...ids, ...replies.map((r) => r.note.id)];

      // Reports: what this viewer reported is gone for them; public notes with enough open reports are gone for all but the author.
      // A note the viewer reported stays hidden for them even after a moderator keeps it.
      const reports = allIds.length
        ? await db
            .select({
              noteId: noteReport.noteId,
              n: sql<number>`count(*) filter (where ${noteReport.status} = 'open')`.mapWith(Number),
              mine: sql<boolean>`bool_or(${noteReport.reporterId} = ${userId})`,
            })
            .from(noteReport)
            .where(inArray(noteReport.noteId, allIds))
            .groupBy(noteReport.noteId)
        : [];
      const reportOf = new Map(reports.map((r) => [r.noteId, r]));
      const hidden = (row: NoteRow, publicNote: boolean) => {
        if (row.userId === userId) return false;
        if (blocked.has(row.userId)) return true;
        const r = reportOf.get(row.id);
        return Boolean(r?.mine) || (publicNote && (r?.n ?? 0) >= REPORTS_TO_HIDE);
      };

      const reactions = allIds.length
        ? await db
            .select({ noteId: noteReaction.noteId, emoji: noteReaction.emoji, n: count(), mine: sql<boolean>`bool_or(${noteReaction.userId} = ${userId})` })
            .from(noteReaction)
            .where(inArray(noteReaction.noteId, allIds))
            .groupBy(noteReaction.noteId, noteReaction.emoji)
        : [];
      const reactionsOf = (id: string) =>
        REACTIONS.flatMap((emoji) => {
          const r = reactions.find((x) => x.noteId === id && x.emoji === emoji);
          return r ? [{ emoji, count: r.n, mine: Boolean(r.mine) }] : [];
        });

      const moderates = (row: NoteRow, top: NoteRow) =>
        top.visibility === 'club' && top.clubId !== null && row.userId !== userId && roleAtLeast(clubs.get(top.clubId), 'admin');

      const toReply = (r: (typeof replies)[number], parent: NoteRow): NoteReply => ({
        id: r.note.id,
        author: { id: r.note.userId, name: r.authorName },
        mine: r.note.userId === userId,
        body: r.note.body,
        createdAt: r.note.createdAt.toISOString(),
        editedAt: r.note.editedAt?.toISOString() ?? null,
        reactions: reactionsOf(r.note.id),
        canModerate: moderates(r.note, parent),
      });

      const notes: Note[] = [];
      for (const t of top) {
        const isPublic = t.note.visibility === 'public';
        const visibleReplies = replies.filter((r) => r.note.parentId === t.note.id && !hidden(r.note, isPublic)).map((r) => toReply(r, t.note));
        // Blocked or reported: the whole thread goes. Deleted by its author: it stays as the anchor of replies the viewer can see.
        if (hidden(t.note, isPublic)) continue;
        const gone = t.note.deletedAt !== null;
        if (gone && visibleReplies.length === 0) continue;
        notes.push({
          id: t.note.id,
          author: { id: t.note.userId, name: t.authorName },
          mine: t.note.userId === userId,
          body: gone ? null : t.note.body,
          createdAt: t.note.createdAt.toISOString(),
          editedAt: t.note.editedAt?.toISOString() ?? null,
          reactions: gone ? [] : reactionsOf(t.note.id),
          canModerate: moderates(t.note, t.note),
          visibility: t.note.visibility,
          club: t.note.clubId && t.clubName ? { id: t.note.clubId, name: t.clubName } : null,
          position: t.note.position,
          page: t.note.page,
          editionId: t.note.editionId,
          replies: visibleReplies,
        });
      }
      return { viewer, notes };
    },

    async create(userId: string, input: z.infer<typeof createNoteInput>): Promise<{ id: string }> {
      const [r] = await db
        .select()
        .from(reading)
        .where(and(eq(reading.id, input.readingId), eq(reading.userId, userId)));
      if (!r) throw new NoteError(400, 'unknown_reading');
      const range = { startPage: r.startPage, endPage: r.endPage };
      let position: number;
      let page: number | null;
      if (input.page !== undefined) {
        if (input.page > r.endPage) throw new NoteError(400, 'page_out_of_range');
        position = input.page < r.startPage ? 0 : pageToPosition(input.page, range);
        page = input.page;
      } else {
        position = percentToPosition(input.percent ?? 0);
        page = null;
      }

      if (input.visibility === 'club') {
        const [membership] = await db
          .select({ editionId: clubBook.editionId, workKey: edition.workKey })
          .from(clubMember)
          .innerJoin(clubBook, and(eq(clubBook.clubId, clubMember.clubId), eq(clubBook.status, 'current')))
          .innerJoin(edition, eq(edition.id, clubBook.editionId))
          .where(and(eq(clubMember.clubId, input.clubId!), eq(clubMember.userId, userId)));
        const clubBookKey = membership ? (membership.workKey ? `w:${membership.workKey}` : `e:${membership.editionId}`) : null;
        if (clubBookKey !== r.bookKey) throw new NoteError(400, 'club_not_reading_this');
      }

      const id = randomUUID();
      const row = {
        id,
        userId,
        bookKey: r.bookKey,
        editionId: r.editionId,
        page,
        position,
        visibility: input.visibility,
        clubId: input.visibility === 'club' ? input.clubId! : null,
        body: input.body,
      };
      await db.insert(note).values(row);
      await announce(row);
      return { id };
    },

    async reply(userId: string, noteId: string, body: string): Promise<{ id: string }> {
      const parent = await loadVisible(noteId, userId);
      if (parent.parentId) throw new NoteError(400, 'reply_to_reply');
      if (parent.deletedAt) throw new NoteError(409, 'note_deleted');
      const id = randomUUID();
      await db.insert(note).values({
        id,
        userId,
        bookKey: parent.bookKey,
        editionId: parent.editionId,
        page: null,
        position: parent.position,
        visibility: parent.visibility,
        clubId: parent.clubId,
        parentId: parent.id,
        body,
      });
      await announce(parent);
      return { id };
    },

    async edit(userId: string, noteId: string, body: string) {
      const row = await loadVisible(noteId, userId);
      if (row.userId !== userId) throw new NoteError(403, 'forbidden');
      if (row.deletedAt) throw new NoteError(409, 'note_deleted');
      await db.update(note).set({ body, editedAt: new Date() }).where(eq(note.id, noteId));
      await announce(row);
    },

    /** Authors delete their own notes; club owners/admins delete club notes. */
    async remove(userId: string, noteId: string) {
      const row = await loadVisible(noteId, userId);
      const top = row.parentId ? (await db.select().from(note).where(eq(note.id, row.parentId)))[0]! : row;
      const moderator = top.visibility === 'club' && top.clubId && roleAtLeast((await myClubs(userId)).get(top.clubId), 'admin');
      if (row.userId !== userId && !moderator) throw new NoteError(403, 'forbidden');
      await deleteNote(row);
      await announce(top);
    },

    /** Toggles one reaction. */
    async react(userId: string, noteId: string, emoji: string) {
      const row = await loadVisible(noteId, userId);
      if (row.deletedAt) throw new NoteError(409, 'note_deleted');
      const deleted = await db
        .delete(noteReaction)
        .where(and(eq(noteReaction.noteId, noteId), eq(noteReaction.userId, userId), eq(noteReaction.emoji, emoji)))
        .returning();
      if (deleted.length === 0) await db.insert(noteReaction).values({ noteId, userId, emoji });
      await announce(row);
    },

    async report(userId: string, noteId: string, input: z.infer<typeof reportInput>) {
      const row = await loadVisible(noteId, userId);
      if (row.userId === userId) throw new NoteError(400, 'own_note');
      const added = await db
        .insert(noteReport)
        .values({ noteId, reporterId: userId, reason: input.reason, details: input.details || null })
        .onConflictDoNothing()
        .returning({ noteId: noteReport.noteId });
      if (added.length === 0 || row.visibility !== 'public') return;
      const [open] = await db.select({ n: count() }).from(noteReport).where(and(eq(noteReport.noteId, noteId), eq(noteReport.status, 'open')));
      // Exactly at the threshold: it just went out of sight for everyone, once.
      if (open?.n === REPORTS_TO_HIDE) {
        onHidden?.(noteId);
        await announce(row);
      }
    },

    /** For moderators: every note or reply with open reports, most reported first. */
    async reportQueue(): Promise<ReportedNote[]> {
      const open = await db
        .select({ report: noteReport, reporter: user.name })
        .from(noteReport)
        .innerJoin(user, eq(user.id, noteReport.reporterId))
        .where(eq(noteReport.status, 'open'))
        .orderBy(asc(noteReport.createdAt));
      if (open.length === 0) return [];
      const rows = await db
        .select({ note, authorName: user.name, clubName: club.name, bookTitle: edition.title })
        .from(note)
        .innerJoin(user, eq(user.id, note.userId))
        .innerJoin(edition, eq(edition.id, note.editionId))
        .leftJoin(club, eq(club.id, note.clubId))
        .where(inArray(note.id, [...new Set(open.map((o) => o.report.noteId))]));
      return rows
        .map(({ note: n, authorName, clubName, bookTitle }) => {
          const reports = open.filter((o) => o.report.noteId === n.id);
          return {
            id: n.id,
            author: { id: n.userId, name: authorName },
            body: n.body,
            isReply: n.parentId !== null,
            visibility: n.visibility,
            club: n.clubId && clubName ? { id: n.clubId, name: clubName } : null,
            bookTitle,
            page: n.page,
            position: n.position,
            createdAt: n.createdAt.toISOString(),
            hidden: n.visibility === 'public' && reports.length >= REPORTS_TO_HIDE,
            reports: reports.map((o) => ({
              reason: o.report.reason,
              details: o.report.details,
              reporter: o.reporter,
              createdAt: o.report.createdAt.toISOString(),
            })),
          };
        })
        .sort((a, b) => b.reports.length - a.reports.length);
    },

    /** A moderator keeps the note: its reports are dismissed and it shows again, except to whoever reported it. */
    async dismissReports(noteId: string) {
      const dismissed = await db
        .update(noteReport)
        .set({ status: 'dismissed' })
        .where(and(eq(noteReport.noteId, noteId), eq(noteReport.status, 'open')))
        .returning({ noteId: noteReport.noteId });
      if (dismissed.length === 0) throw notFound();
      const [row] = await db.select().from(note).where(eq(note.id, noteId));
      if (row) await announce(row);
    },

    /** A moderator removes a reported note or reply. */
    async removeReported(noteId: string) {
      const [row] = await db.select().from(note).where(eq(note.id, noteId));
      if (!row) throw notFound();
      await db
        .update(noteReport)
        .set({ status: 'actioned' })
        .where(and(eq(noteReport.noteId, noteId), eq(noteReport.status, 'open')));
      await announce(await deleteNote(row));
    },

    async block(userId: string, targetId: string) {
      if (targetId === userId) throw new NoteError(400, 'self');
      const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, targetId));
      if (!target) throw notFound();
      await db.insert(userBlock).values({ blockerId: userId, blockedId: targetId }).onConflictDoNothing();
    },

    async unblock(userId: string, targetId: string) {
      await db.delete(userBlock).where(and(eq(userBlock.blockerId, userId), eq(userBlock.blockedId, targetId)));
    },

    async blocks(userId: string) {
      const rows = await db
        .select({ id: user.id, name: user.name, blockedAt: userBlock.createdAt })
        .from(userBlock)
        .innerJoin(user, eq(user.id, userBlock.blockedId))
        .where(eq(userBlock.blockerId, userId))
        .orderBy(asc(user.name));
      return rows.map((r) => ({ ...r, blockedAt: r.blockedAt.toISOString() }));
    },
  };
}

export type NoteService = ReturnType<typeof createNoteService>;
