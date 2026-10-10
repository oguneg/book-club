import { bookKeyOf, POSITION_SCALE, type ActivityItem } from '@bookclub/shared';
import { and, asc, eq, gte, inArray, isNull, ne, or } from 'drizzle-orm';
import { borrowedCovers, withCover } from '../books/service';
import type { Db } from '../db/client';
import { club, clubBook, clubMember, edition, note, noteReport, progressEvent, reading, user, userBlock } from '../db/schema';

/** How far back Home looks. */
const WINDOW_DAYS = 14;
const MAX_ITEMS = 50;

type Person = ActivityItem['person'];
type Club = ActivityItem['club'];
type Book = Extract<ActivityItem, { kind: 'progress' }>['book'];

/**
 * What happened lately in the viewer's clubs, newest first: members' reading of the club's book (one item
 * per reader per day), club notes (their text only once the viewer has read that far), finishes and new
 * members. Only the club's current book counts; what members read on their own stays private. People
 * blocked either way, and notes the viewer reported, are left out.
 */
export function createActivityService({ db }: { db: Db }) {
  return {
    async list(userId: string, now = new Date()): Promise<ActivityItem[]> {
      const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const mine = await db
        .select({ id: club.id, name: club.name })
        .from(clubMember)
        .innerJoin(club, eq(club.id, clubMember.clubId))
        .where(eq(clubMember.userId, userId));
      if (mine.length === 0) return [];
      const clubIds = mine.map((c) => c.id);
      const clubOf = new Map<string, Club>(mine.map((c) => [c.id, c]));

      const [blocks, members, books] = await Promise.all([
        db
          .select({ a: userBlock.blockerId, b: userBlock.blockedId })
          .from(userBlock)
          .where(or(eq(userBlock.blockerId, userId), eq(userBlock.blockedId, userId))),
        db
          .select({ clubId: clubMember.clubId, userId: clubMember.userId, joinedAt: clubMember.joinedAt, name: user.name, image: user.image })
          .from(clubMember)
          .innerJoin(user, eq(user.id, clubMember.userId))
          .where(and(inArray(clubMember.clubId, clubIds), ne(clubMember.userId, userId))),
        db
          .select({ clubId: clubBook.clubId, edition })
          .from(clubBook)
          .innerJoin(edition, eq(edition.id, clubBook.editionId))
          .where(and(inArray(clubBook.clubId, clubIds), eq(clubBook.status, 'current'))),
      ]);
      const blocked = new Set(blocks.map((r) => (r.a === userId ? r.b : r.a)));
      const people = new Map<string, Person>();
      for (const m of members) if (!blocked.has(m.userId)) people.set(m.userId, { id: m.userId, name: m.name, image: m.image });
      const covers = await borrowedCovers(db, books.map((b) => b.edition));
      // The club's book, by club; a book shared by two of your clubs is credited to the first.
      const bookOf = new Map<string, Book>();
      const clubOfBook = new Map<string, string>();
      for (const b of books) {
        const key = bookKeyOf(b.edition);
        bookOf.set(b.clubId, { title: b.edition.title, cover: withCover(b.edition, covers).cover, bookKey: key });
        if (!clubOfBook.has(key)) clubOfBook.set(key, b.clubId);
      }
      // Which clubs each person shares with you, to find "their" club for a book.
      const clubsOf = new Map<string, Set<string>>();
      for (const m of members) clubsOf.set(m.userId, (clubsOf.get(m.userId) ?? new Set()).add(m.clubId));
      const sharedClubFor = (personId: string, bookKey: string) =>
        [...(clubsOf.get(personId) ?? [])].find((c) => bookOf.get(c)?.bookKey === bookKey) ?? null;

      const items: ActivityItem[] = [];

      // New members.
      for (const m of members) {
        const p = people.get(m.userId);
        if (p && m.joinedAt >= since) items.push({ kind: 'joined', id: `joined:${m.clubId}:${m.userId}`, at: m.joinedAt.toISOString(), person: p, club: clubOf.get(m.clubId)! });
      }

      const bookKeys = [...clubOfBook.keys()];
      const readerIds = [...people.keys()];
      if (bookKeys.length > 0 && readerIds.length > 0) {
        const readings = await db
          .select()
          .from(reading)
          .where(and(inArray(reading.bookKey, bookKeys), inArray(reading.userId, readerIds), ne(reading.status, 'stopped')));
        const events = readings.length
          ? await db
              .select()
              .from(progressEvent)
              .where(inArray(
                progressEvent.readingId,
                readings.map((r) => r.id),
              ))
              .orderBy(asc(progressEvent.createdAt))
          : [];
        for (const r of readings) {
          const clubId = sharedClubFor(r.userId, r.bookKey);
          if (!clubId) continue;
          const base = { person: people.get(r.userId)!, club: clubOf.get(clubId)!, book: bookOf.get(clubId)! };
          if (r.status === 'finished' && r.finishedAt && r.finishedAt >= since) {
            items.push({ kind: 'finished', id: `finished:${r.id}`, at: r.finishedAt.toISOString(), ...base });
          }
          // One item per reader per day: pages read that day (in their copy) and where they ended up.
          const span = Math.max(1, r.endPage - r.startPage + 1);
          const days = new Map<string, { at: Date; moved: number; position: number }>();
          let previous = 0;
          for (const ev of events.filter((e) => e.readingId === r.id)) {
            const moved = ev.position - previous;
            previous = ev.position;
            if (ev.createdAt < since) continue;
            const day = ev.createdAt.toISOString().slice(0, 10);
            const d = days.get(day) ?? { at: ev.createdAt, moved: 0, position: ev.position };
            days.set(day, { at: ev.createdAt, moved: d.moved + moved, position: ev.position });
          }
          for (const [day, d] of days) {
            const pages = Math.round((d.moved / POSITION_SCALE) * span);
            // Finishing is its own item; a correction backwards isn't news.
            if (pages <= 0 || (r.finishedAt && r.finishedAt.toISOString().slice(0, 10) === day)) continue;
            items.push({ kind: 'progress', id: `progress:${r.id}:${day}`, at: d.at.toISOString(), pages, position: d.position, ...base });
          }
        }

        // Club notes, and replies to the viewer's own notes.
        const myPlace = new Map<string, number>();
        const myReadings = await db
          .select({ bookKey: reading.bookKey, position: reading.position })
          .from(reading)
          .where(and(eq(reading.userId, userId), inArray(reading.bookKey, bookKeys)));
        for (const r of myReadings) myPlace.set(r.bookKey, Math.max(myPlace.get(r.bookKey) ?? 0, r.position));
        const notes = await db
          .select()
          .from(note)
          .where(
            and(
              inArray(note.clubId, clubIds),
              eq(note.visibility, 'club'),
              inArray(note.userId, readerIds),
              isNull(note.deletedAt),
              gte(note.createdAt, since),
            ),
          );
        const parentIds = [...new Set(notes.map((n) => n.parentId).filter((id): id is string => Boolean(id)))];
        const [parents, reported] = await Promise.all([
          parentIds.length ? db.select({ id: note.id, userId: note.userId }).from(note).where(inArray(note.id, parentIds)) : [],
          notes.length
            ? db
                .select({ noteId: noteReport.noteId })
                .from(noteReport)
                .where(and(eq(noteReport.reporterId, userId), inArray(noteReport.noteId, notes.map((n) => n.id))))
            : [],
        ]);
        const parentAuthor = new Map(parents.map((p) => [p.id, p.userId]));
        const skip = new Set(reported.map((r) => r.noteId));
        for (const n of notes) {
          if (skip.has(n.id) || !n.clubId || !clubOf.has(n.clubId) || !bookOf.get(n.clubId)) continue;
          const replyToYou = n.parentId !== null && parentAuthor.get(n.parentId) === userId;
          if (n.parentId !== null && !replyToYou) continue;
          const ahead = n.position > (myPlace.get(n.bookKey) ?? 0);
          items.push({
            kind: 'note',
            id: `note:${n.id}`,
            at: n.createdAt.toISOString(),
            person: people.get(n.userId)!,
            club: clubOf.get(n.clubId)!,
            book: bookOf.get(n.clubId)!,
            noteId: n.parentId ?? n.id,
            position: n.position,
            body: ahead ? null : n.body,
            ahead,
            replyToYou,
          });
        }
      }

      return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_ITEMS);
    },
  };
}

export type ActivityService = ReturnType<typeof createActivityService>;
