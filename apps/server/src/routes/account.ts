import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Auth } from '../auth';
import type { Db } from '../db/client';
import { account, club, clubMember, edition, note, noteReaction, noteReport, progressEvent, reading, readingGoal, session, user as userTable, userBlock, wantToRead } from '../db/schema';
import { createRateLimiter } from '../rate-limit';
import { requireSession, type SignedInEnv } from '../session';

/**
 * Everything stored about a user, as JSON (GDPR access and portability): profile, sign-in, clubs, reading,
 * books they want to read, notes and what they did to others' notes. Secrets are never included: no password hashes, tokens or session keys.
 */
export async function exportUserData(db: Db, user: SignedInEnv['Variables']['user'], currentSessionId: string) {
  const methods = await db
    .select({ provider: account.providerId, connectedAt: account.createdAt })
    .from(account)
    .where(eq(account.userId, user.id));
  const sessions = await db
    .select({ id: session.id, createdAt: session.createdAt, expiresAt: session.expiresAt, ipAddress: session.ipAddress, userAgent: session.userAgent })
    .from(session)
    .where(eq(session.userId, user.id));
  const [clubs, readings, progress, wanted, notes, reactions, reports, blocks] = await Promise.all([
    db
      .select({ club: club.name, role: clubMember.role, joinedAt: clubMember.joinedAt })
      .from(clubMember)
      .innerJoin(club, eq(club.id, clubMember.clubId))
      .where(eq(clubMember.userId, user.id)),
    db
      .select({
        id: reading.id,
        title: edition.title,
        authors: edition.authors,
        isbn13: edition.isbn13,
        startPage: reading.startPage,
        endPage: reading.endPage,
        currentPage: reading.currentPage,
        position: reading.position,
        status: reading.status,
        startedAt: reading.startedAt,
        finishedAt: reading.finishedAt,
        finishBy: reading.targetDate,
      })
      .from(reading)
      .innerJoin(edition, eq(edition.id, reading.editionId))
      .where(eq(reading.userId, user.id))
      .orderBy(asc(reading.startedAt)),
    db
      .select({ readingId: progressEvent.readingId, page: progressEvent.page, position: progressEvent.position, at: progressEvent.createdAt })
      .from(progressEvent)
      .innerJoin(reading, eq(reading.id, progressEvent.readingId))
      .where(eq(reading.userId, user.id))
      .orderBy(asc(progressEvent.createdAt)),
    db
      .select({ title: edition.title, authors: edition.authors, isbn13: edition.isbn13, addedAt: wantToRead.createdAt })
      .from(wantToRead)
      .innerJoin(edition, eq(edition.id, wantToRead.editionId))
      .where(eq(wantToRead.userId, user.id))
      .orderBy(asc(wantToRead.createdAt)),
    db
      .select({
        id: note.id,
        replyTo: note.parentId,
        book: edition.title,
        page: note.page,
        position: note.position,
        visibility: note.visibility,
        club: club.name,
        body: note.body,
        createdAt: note.createdAt,
        editedAt: note.editedAt,
        deletedAt: note.deletedAt,
      })
      .from(note)
      .innerJoin(edition, eq(edition.id, note.editionId))
      .leftJoin(club, eq(club.id, note.clubId))
      .where(eq(note.userId, user.id))
      .orderBy(asc(note.createdAt)),
    db.select({ noteId: noteReaction.noteId, emoji: noteReaction.emoji, at: noteReaction.createdAt }).from(noteReaction).where(eq(noteReaction.userId, user.id)),
    db
      .select({ noteId: noteReport.noteId, reason: noteReport.reason, details: noteReport.details, status: noteReport.status, at: noteReport.createdAt })
      .from(noteReport)
      .where(eq(noteReport.reporterId, user.id)),
    db
      .select({ name: userTable.name, at: userBlock.createdAt })
      .from(userBlock)
      .innerJoin(userTable, eq(userTable.id, userBlock.blockedId))
      .where(eq(userBlock.blockerId, user.id)),
  ]);
  // Positions are stored as 0..10000; a percentage reads better outside the app.
  const percent = (position: number) => position / 100;
  return {
    format: 'bookclub-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailConfirmed: user.emailVerified,
      image: user.image ?? null,
      createdAt: user.createdAt,
    },
    signInMethods: methods.map((m) => ({ method: m.provider === 'credential' ? 'password' : m.provider, connectedAt: m.connectedAt })),
    signedInDevices: sessions.map(({ id, ...rest }) => ({ ...rest, thisDevice: id === currentSessionId })),
    clubs,
    readings: readings.map(({ id, position, ...r }) => ({
      ...r,
      percent: percent(position),
      progress: progress.filter((e) => e.readingId === id).map(({ page, position: at, ...e }) => ({ ...e, page, percent: percent(at) })),
    })),
    wantToRead: wanted,
    goals: (await db.select({ yearlyBooks: readingGoal.yearlyBooks, dailyPages: readingGoal.dailyPages }).from(readingGoal).where(eq(readingGoal.userId, user.id)))[0] ?? null,
    notes: notes.map(({ position, ...n }) => ({ ...n, percent: percent(position) })),
    reactions,
    reports,
    blocked: blocks,
  };
}

export function accountRoutes({ auth, db }: { auth: Auth; db: Db }) {
  // A dozen queries per export; nobody needs more than a few an hour.
  const allowExport = createRateLimiter({ windowMs: 60 * 60_000, max: 5 });
  return new Hono<SignedInEnv>().use(requireSession(auth)).get('/export', async (c) => {
    if (!allowExport(c.get('user').id)) return c.json({ error: 'rate_limited' }, 429);
    const data = await exportUserData(db, c.get('user'), c.get('session').id);
    const date = new Date().toISOString().slice(0, 10);
    c.header('Content-Disposition', `attachment; filename="bookclub-data-${date}.json"`);
    c.header('Cache-Control', 'no-store');
    return c.json(data);
  });
}
