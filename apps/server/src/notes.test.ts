import { randomUUID } from 'node:crypto';
import { blockListResponse, clubResponse, notesResponse, readingResponse, reportQueueResponse, type Note } from '@bookclub/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './db/client';
import { edition } from './db/schema';
import { Browser, captureMailer, signedInUser, testApp, testDatabase, uniqueEmail } from './test/helpers';

let database: Database;

beforeAll(async () => {
  database = await testDatabase();
});

afterAll(async () => {
  await database?.close();
});

const newWork = () => `OL${Math.floor(Math.random() * 1e9)}W`;

async function anEdition(workKey: string, pageCount: number) {
  const id = randomUUID();
  await database.db.insert(edition).values({ id, source: 'manual', title: 'The Hobbit', authors: ['J.R.R. Tolkien'], pageCount, workKey });
  return id;
}

/** A book (work) with two editions, and three readers: two in a club reading it, one outsider. */
async function world() {
  const mail = captureMailer();
  const ctx = testApp(database, {}, mail.mailer);
  const user = (name: string) => signedInUser(ctx.app, ctx.env.APP_URL, mail, name);
  const work = newWork();
  const paperback = await anEdition(work, 300);
  const hardcover = await anEdition(work, 400);
  const [ann, bob, cat] = await Promise.all([user('Ann Author'), user('Bob Clubmate'), user('Cat Outsider')]);
  const club = clubResponse.parse(await (await ann.browser.post('/api/clubs', { name: 'Readers' })).json()).club;
  await bob.browser.post(`/api/invites/${club.inviteCode}/join`);
  await ann.browser.request(`/api/clubs/${club.id}/book`, { method: 'PUT', json: { editionId: paperback } });
  const read = async (b: Browser, editionId: string, endPage: number) =>
    readingResponse.parse(await (await b.post('/api/readings', { editionId, startPage: 1, endPage })).json()).reading;
  const annReading = await read(ann.browser, paperback, 300);
  const bobReading = await read(bob.browser, hardcover, 400);
  return { ...ctx, user, ann, bob, cat, club, bookKey: `w:${work}`, annReading, bobReading, paperback, hardcover };
}

async function notesFor(browser: Browser, bookKey: string, scope = 'all') {
  const res = await browser.request(`/api/notes?book=${encodeURIComponent(bookKey)}&scope=${encodeURIComponent(scope)}`);
  expect(res.status).toBe(200);
  return notesResponse.parse(await res.json());
}

async function write(browser: Browser, body: object): Promise<string> {
  const res = await browser.post('/api/notes', body);
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

const bodies = (notes: Note[]) => notes.map((n) => n.body);

describe('who sees which note', () => {
  it('private to the author, club notes to the club, public to everyone', async () => {
    const w = await world();
    const base = { readingId: w.annReading.id, page: 120 };
    await write(w.ann.browser, { ...base, body: 'my own thought', visibility: 'private' });
    await write(w.ann.browser, { ...base, body: 'for the club', visibility: 'club', clubId: w.club.id });
    await write(w.ann.browser, { ...base, body: 'for everyone', visibility: 'public' });

    expect(bodies((await notesFor(w.ann.browser, w.bookKey)).notes)).toEqual(['my own thought', 'for the club', 'for everyone']);
    expect(bodies((await notesFor(w.bob.browser, w.bookKey)).notes)).toEqual(['for the club', 'for everyone']);
    expect(bodies((await notesFor(w.cat.browser, w.bookKey)).notes)).toEqual(['for everyone']);

    expect(bodies((await notesFor(w.bob.browser, w.bookKey, 'public')).notes)).toEqual(['for everyone']);
    expect(bodies((await notesFor(w.bob.browser, w.bookKey, `club:${w.club.id}`)).notes)).toEqual(['for the club']);
    expect(bodies((await notesFor(w.ann.browser, w.bookKey, 'mine')).notes)).toHaveLength(3);
  });

  it("places notes by position and tells each viewer where they are in their own edition", async () => {
    const w = await world();
    await w.bob.browser.post(`/api/readings/${w.bobReading.id}/progress`, { page: 100 });
    await write(w.ann.browser, { readingId: w.annReading.id, page: 120, body: 'riddles!', visibility: 'public' });
    const { viewer, notes } = await notesFor(w.bob.browser, w.bookKey);
    expect(notes[0]).toMatchObject({ position: 4000, page: 120, editionId: w.paperback, author: { name: 'Ann Author' }, mine: false });
    expect(viewer).toEqual({ position: 2500, editionId: w.hardcover, startPage: 1, endPage: 400 });
    expect((await notesFor(w.cat.browser, w.bookKey)).viewer).toBeNull();
  });

  it('only lets club notes go to a club reading this book', async () => {
    const w = await world();
    const other = clubResponse.parse(await (await w.ann.browser.post('/api/clubs', { name: 'Other book club' })).json()).club;
    const res = await w.ann.browser.post('/api/notes', { readingId: w.annReading.id, page: 5, body: 'x', visibility: 'club', clubId: other.id });
    expect(await res.json()).toEqual({ error: 'club_not_reading_this' });
    const notMine = await w.cat.browser.post('/api/notes', { readingId: w.annReading.id, page: 5, body: 'x', visibility: 'public' });
    expect(await notMine.json()).toEqual({ error: 'unknown_reading' });
  });

  it('rejects bad input', async () => {
    const w = await world();
    expect((await w.ann.browser.post('/api/notes', { readingId: w.annReading.id, page: 301, body: 'x', visibility: 'public' })).status).toBe(400);
    expect((await w.ann.browser.post('/api/notes', { readingId: w.annReading.id, page: 1, body: '   ', visibility: 'public' })).status).toBe(400);
    expect((await w.ann.browser.request('/api/notes?book=nonsense')).status).toBe(400);
  });
});

describe('conversation', () => {
  it('replies inherit the note’s audience and nest one level', async () => {
    const w = await world();
    const id = await write(w.ann.browser, { readingId: w.annReading.id, page: 50, body: 'club only', visibility: 'club', clubId: w.club.id });
    const replyRes = await w.bob.browser.post(`/api/notes/${id}/replies`, { body: 'agreed' });
    expect(replyRes.status).toBe(201);
    const replyId = ((await replyRes.json()) as { id: string }).id;
    expect((await w.cat.browser.post(`/api/notes/${id}/replies`, { body: 'let me in' })).status).toBe(404);
    expect((await w.ann.browser.post(`/api/notes/${replyId}/replies`, { body: 'nested' })).status).toBe(400);

    const [n] = (await notesFor(w.ann.browser, w.bookKey)).notes;
    expect(n?.replies.map((r) => [r.author.name, r.body])).toEqual([['Bob Clubmate', 'agreed']]);
    expect((await notesFor(w.cat.browser, w.bookKey)).notes).toEqual([]);
  });

  it('reactions toggle and count', async () => {
    const w = await world();
    const id = await write(w.ann.browser, { readingId: w.annReading.id, page: 50, body: 'public', visibility: 'public' });
    await w.bob.browser.post(`/api/notes/${id}/reactions`, { emoji: '❤️' });
    await w.cat.browser.post(`/api/notes/${id}/reactions`, { emoji: '❤️' });
    await w.cat.browser.post(`/api/notes/${id}/reactions`, { emoji: '😂' });
    await w.cat.browser.post(`/api/notes/${id}/reactions`, { emoji: '😂' });
    expect((await w.cat.browser.post(`/api/notes/${id}/reactions`, { emoji: '🍕' })).status).toBe(400);
    const [n] = (await notesFor(w.bob.browser, w.bookKey)).notes;
    expect(n?.reactions).toEqual([{ emoji: '❤️', count: 2, mine: true }]);
  });

  it('authors edit; deleting leaves a placeholder while replies remain', async () => {
    const w = await world();
    const withReply = await write(w.ann.browser, { readingId: w.annReading.id, page: 10, body: 'first', visibility: 'public' });
    const alone = await write(w.ann.browser, { readingId: w.annReading.id, page: 20, body: 'second', visibility: 'public' });
    await w.bob.browser.post(`/api/notes/${withReply}/replies`, { body: 'reply' });

    expect((await w.bob.browser.request(`/api/notes/${withReply}`, { method: 'PATCH', json: { body: 'hijack' } })).status).toBe(403);
    expect((await w.ann.browser.request(`/api/notes/${withReply}`, { method: 'PATCH', json: { body: 'first, edited' } })).status).toBe(204);
    expect((await w.bob.browser.request(`/api/notes/${alone}`, { method: 'DELETE' })).status).toBe(403);

    await w.ann.browser.request(`/api/notes/${withReply}`, { method: 'DELETE' });
    await w.ann.browser.request(`/api/notes/${alone}`, { method: 'DELETE' });
    const { notes } = await notesFor(w.cat.browser, w.bookKey);
    expect(notes.map((n) => [n.body, n.replies.length])).toEqual([[null, 1]]);
  });

  it('club owners and admins remove club notes, not public ones', async () => {
    const w = await world();
    const clubNote = await write(w.bob.browser, { readingId: w.bobReading.id, page: 10, body: 'off topic', visibility: 'club', clubId: w.club.id });
    const publicNote = await write(w.bob.browser, { readingId: w.bobReading.id, page: 10, body: 'public', visibility: 'public' });
    const seen = (await notesFor(w.ann.browser, w.bookKey)).notes;
    expect(seen.find((n) => n.id === clubNote)?.canModerate).toBe(true);
    expect(seen.find((n) => n.id === publicNote)?.canModerate).toBe(false);
    expect((await w.ann.browser.request(`/api/notes/${publicNote}`, { method: 'DELETE' })).status).toBe(403);
    expect((await w.ann.browser.request(`/api/notes/${clubNote}`, { method: 'DELETE' })).status).toBe(204);
  });
});

describe('safety', () => {
  it('a report hides the note for the reporter; three hide a public note for everyone but its author', async () => {
    const w = await world();
    const id = await write(w.ann.browser, { readingId: w.annReading.id, page: 10, body: 'rude', visibility: 'public' });
    expect((await w.ann.browser.post(`/api/notes/${id}/report`, { reason: 'offensive' })).status).toBe(400);
    expect((await w.bob.browser.post(`/api/notes/${id}/report`, { reason: 'offensive' })).status).toBe(204);
    expect((await notesFor(w.bob.browser, w.bookKey)).notes).toEqual([]);
    expect((await notesFor(w.cat.browser, w.bookKey)).notes).toHaveLength(1);

    // Two more reporters reach the threshold.
    for (const reporter of await Promise.all([w.user('Dan Third'), w.user('Eve Fourth')])) {
      await reporter.browser.post(`/api/notes/${id}/report`, { reason: 'spam' });
    }
    expect((await notesFor(w.cat.browser, w.bookKey)).notes).toEqual([]);
    expect((await notesFor(w.ann.browser, w.bookKey)).notes).toHaveLength(1);
  });

  it('blocking hides notes both ways, until unblocked', async () => {
    const w = await world();
    await write(w.ann.browser, { readingId: w.annReading.id, page: 10, body: 'from ann', visibility: 'public' });
    const annNote = await write(w.bob.browser, { readingId: w.bobReading.id, page: 10, body: 'from bob', visibility: 'public' }).then(() =>
      write(w.ann.browser, { readingId: w.annReading.id, page: 20, body: 'ann again', visibility: 'public' }),
    );
    await w.bob.browser.post(`/api/notes/${annNote}/replies`, { body: 'bob replies to ann' });

    expect((await w.bob.browser.request(`/api/blocks/${w.ann.userId}`, { method: 'PUT' })).status).toBe(204);
    // Ann's thread is gone for Bob entirely, his own reply in it included; Bob's reply is gone for Ann.
    expect(bodies((await notesFor(w.bob.browser, w.bookKey)).notes)).toEqual(['from bob']);
    const annSees = (await notesFor(w.ann.browser, w.bookKey)).notes;
    expect(annSees.map((n) => [n.body, n.replies.length])).toEqual([['from ann', 0], ['ann again', 0]]);
    expect((await w.bob.browser.post(`/api/notes/${annNote}/replies`, { body: 'again' })).status).toBe(404);
    expect(blockListResponse.parse(await (await w.bob.browser.request('/api/blocks')).json()).blocked.map((b) => b.name)).toEqual(['Ann Author']);

    await w.bob.browser.request(`/api/blocks/${w.ann.userId}`, { method: 'DELETE' });
    expect((await notesFor(w.bob.browser, w.bookKey)).notes).toHaveLength(3);
    expect((await w.bob.browser.request(`/api/blocks/${w.bob.userId}`, { method: 'PUT' })).status).toBe(400);
  });
});

describe('live updates', () => {
  it('tell club members about club notes, and readers of the book about public ones', async () => {
    const w = await world();
    const inbox = () => {
      const received: unknown[] = [];
      return { received, send: (d: string) => received.push(JSON.parse(d)) };
    };
    const [bobBox, catBox] = [inbox(), inbox()];
    w.live.add(w.bob.userId, bobBox);
    w.live.add(w.cat.userId, catBox);

    await write(w.ann.browser, { readingId: w.annReading.id, page: 10, body: 'club', visibility: 'club', clubId: w.club.id });
    expect(bobBox.received).toContainEqual({ type: 'notes', bookKey: w.bookKey });
    expect(catBox.received).toEqual([]);

    await write(w.ann.browser, { readingId: w.annReading.id, page: 10, body: 'public', visibility: 'public' });
    // Cat isn't reading this book, so isn't told; Bob is.
    expect(catBox.received).toEqual([]);
    expect(bobBox.received.filter((e) => JSON.stringify(e).includes('notes'))).toHaveLength(2);
  });
});

describe('data export', () => {
  it('includes my readings, notes, reactions, reports and blocks', async () => {
    const w = await world();
    const mine = await write(w.bob.browser, { readingId: w.bobReading.id, page: 100, body: 'mine', visibility: 'club', clubId: w.club.id });
    const annNote = await write(w.ann.browser, { readingId: w.annReading.id, page: 30, body: 'ann', visibility: 'public' });
    await w.bob.browser.post(`/api/notes/${annNote}/reactions`, { emoji: '🤔' });
    await w.bob.browser.post(`/api/notes/${annNote}/report`, { reason: 'spoiler' });
    await w.bob.browser.request(`/api/blocks/${w.ann.userId}`, { method: 'PUT' });

    const data = (await (await w.bob.browser.request('/api/account/export')).json()) as Record<string, unknown>;
    expect(data.clubs).toEqual([{ club: 'Readers', role: 'member', joinedAt: expect.any(String) }]);
    expect(data.readings).toMatchObject([{ title: 'The Hobbit', endPage: 400, status: 'reading', percent: 0 }]);
    expect(data.notes).toMatchObject([{ id: mine, body: 'mine', page: 100, percent: 25, visibility: 'club', club: 'Readers', replyTo: null }]);
    expect(data.reactions).toMatchObject([{ noteId: annNote, emoji: '🤔' }]);
    expect(data.reports).toMatchObject([{ noteId: annNote, reason: 'spoiler', status: 'open' }]);
    expect(data.blocked).toMatchObject([{ name: 'Ann Author' }]);
  });
});

describe('moderation', () => {
  it('does not exist for anyone but moderators', async () => {
    const w = await world();
    expect((await new Browser(w.app, w.env.APP_URL).request('/api/admin')).status).toBe(401);
    expect((await w.ann.browser.request('/api/admin')).status).toBe(404);
    expect((await w.ann.browser.request('/api/admin/reports')).status).toBe(404);
  });

  it('emails moderators once when reports hide a note; they keep it or remove it', async () => {
    const mail = captureMailer();
    const moderatorEmail = uniqueEmail('mod');
    const ctx = testApp(database, { ADMIN_EMAILS: ` ${moderatorEmail.toUpperCase()}, other@example.com` }, mail.mailer);
    const user = (name: string, email?: string) => signedInUser(ctx.app, ctx.env.APP_URL, mail, name, email);
    const work = newWork();
    const editionId = await anEdition(work, 300);
    const bookKey = `w:${work}`;
    const [author, mod, ...reporters] = await Promise.all([
      user('Al Author'),
      user('Mo Moderator', moderatorEmail),
      user('Rae One'),
      user('Rae Two'),
      user('Rae Three'),
      user('Rae Four'),
    ]);
    const readingId = readingResponse.parse(await (await author.browser.post('/api/readings', { editionId, startPage: 1, endPage: 300 })).json()).reading.id;
    const kept = await write(author.browser, { readingId, page: 10, body: 'fine, actually', visibility: 'public' });
    const removed = await write(author.browser, { readingId, page: 20, body: 'truly awful', visibility: 'public' });
    const alerts = () => mail.sent.filter((m) => m.subject.includes('needs review'));

    for (const r of reporters.slice(0, 3)) {
      await r.browser.post(`/api/notes/${kept}/report`, { reason: 'offensive' });
      await r.browser.post(`/api/notes/${removed}/report`, { reason: 'spam', details: 'selling things' });
    }
    await reporters[3]!.browser.post(`/api/notes/${kept}/report`, { reason: 'offensive' });
    // One email per hidden note, to every moderator, none for reports past the threshold.
    expect(alerts().map((m) => m.to).sort()).toEqual(['other@example.com', 'other@example.com', moderatorEmail, moderatorEmail].sort());
    expect(alerts()[0]?.text).toContain(`${ctx.env.APP_URL}/admin/reports`);
    expect(alerts()[0]?.text).not.toContain('truly awful');

    expect((await mod.browser.request('/api/admin')).status).toBe(200);
    // The queue is global; other tests share this database.
    const queueOf = async () =>
      reportQueueResponse.parse(await (await mod.browser.request('/api/admin/reports')).json()).notes.filter((n) => [kept, removed].includes(n.id));
    const queue = await queueOf();
    expect(queue.map((n) => [n.body, n.reports.length, n.hidden])).toEqual([
      ['fine, actually', 4, true],
      ['truly awful', 3, true],
    ]);
    expect(queue[1]?.reports[0]).toMatchObject({ reason: 'spam', details: 'selling things', reporter: 'Rae One' });
    expect((await notesFor(mod.browser, bookKey)).notes).toEqual([]);

    expect((await mod.browser.post(`/api/admin/reports/${kept}/dismiss`, {})).status).toBe(204);
    expect((await mod.browser.post(`/api/admin/reports/${removed}/remove`, {})).status).toBe(204);
    expect(bodies((await notesFor(mod.browser, bookKey)).notes)).toEqual(['fine, actually']);
    // Whoever reported it still doesn't see it.
    expect((await notesFor(reporters[0]!.browser, bookKey)).notes).toEqual([]);
    expect(await queueOf()).toEqual([]);
    expect((await mod.browser.post(`/api/admin/reports/${kept}/dismiss`, {})).status).toBe(404);
  });
});
