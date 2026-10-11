import { randomUUID } from 'node:crypto';
import { clubResponse, notificationsResponse, readingResponse, type NotificationItem } from '@bookclub/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './db/client';
import { edition, pushToken } from './db/schema';
import { formatSoon } from './notifications/service';
import { Browser, captureMailer, signedInUser, testApp, testDatabase } from './test/helpers';

let database: Database;

beforeAll(async () => {
  database = await testDatabase();
});

afterAll(async () => {
  await database?.close();
});

const newWork = () => `OL${Math.floor(Math.random() * 1e9)}W`;

async function anEdition(workKey: string, pageCount: number, title = 'The Hobbit') {
  const id = randomUUID();
  await database.db.insert(edition).values({ id, source: 'manual', title, authors: ['J.R.R. Tolkien'], pageCount, workKey });
  return id;
}

/** A club (Ann owns it) reading a book in a 300-page paperback; Bob reads a 400-page hardcover. */
async function world() {
  const mail = captureMailer();
  const ctx = testApp(database, {}, mail.mailer);
  const user = (name: string) => signedInUser(ctx.app, ctx.env.APP_URL, mail, name);
  const work = newWork();
  const paperback = await anEdition(work, 300);
  const hardcover = await anEdition(work, 400, 'The Hobbit (hardcover)');
  const [ann, bob] = await Promise.all([user('Ann Owner'), user('Bob Member')]);
  const club = clubResponse.parse(await (await ann.browser.post('/api/clubs', { name: 'Readers' })).json()).club;
  await ann.browser.request(`/api/clubs/${club.id}/book`, { method: 'PUT', json: { editionId: paperback } });
  await bob.browser.post(`/api/invites/${club.inviteCode}/join`);
  const read = async (b: Browser, editionId: string, endPage: number) =>
    readingResponse.parse(await (await b.post('/api/readings', { editionId, startPage: 1, endPage })).json()).reading;
  const annReading = await read(ann.browser, paperback, 300);
  const bobReading = await read(bob.browser, hardcover, 400);
  return { ...ctx, user, ann, bob, club, work, paperback, hardcover, annReading, bobReading };
}

async function bell(browser: Browser) {
  const res = await browser.request('/api/notifications');
  expect(res.status).toBe(200);
  return notificationsResponse.parse(await res.json());
}

/** Notifications go out after the request that caused them has answered: wait for them. */
async function eventually(browser: Browser, ok: (items: NotificationItem[]) => boolean) {
  for (let i = 0; i < 100; i++) {
    const { items } = await bell(browser);
    if (ok(items)) return items;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out; bell has ${JSON.stringify((await bell(browser)).items.map((n) => n.kind))}`);
}

async function quietly() {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

const phone = (name: string) => `ExponentPushToken[${name}-${randomUUID().slice(0, 8)}]`;

describe('replies', () => {
  it("reach the note's author, on their phone too, without a word of the reply", async () => {
    const w = await world();
    const token = phone('bob');
    expect((await w.bob.browser.request('/api/notifications/devices', { method: 'PUT', json: { token, platform: 'ios', timeZone: 'Europe/Stockholm' } })).status).toBe(204);
    await w.bob.browser.post(`/api/readings/${w.bobReading.id}/progress`, { page: 200 });
    const noteRes = await w.bob.browser.post('/api/notes', { readingId: w.bobReading.id, page: 160, body: 'the riddles!', visibility: 'club', clubId: w.club.id });
    const noteId = ((await noteRes.json()) as { id: string }).id;
    await w.ann.browser.post(`/api/notes/${noteId}/replies`, { body: 'Gollum is the best part' });

    const items = await eventually(w.bob.browser, (all) => all.some((n) => n.kind === 'reply'));
    expect(items.find((n) => n.kind === 'reply')).toMatchObject({
      read: false,
      person: { name: 'Ann Owner' },
      club: { id: w.club.id, name: 'Readers' },
      book: { title: 'The Hobbit (hardcover)' },
      page: 160,
      url: `/readings/${w.bobReading.id}`,
    });
    const pushed = w.pushed.find((m) => m.to === token && m.title.includes('replied'));
    expect(pushed).toMatchObject({ title: 'Ann Owner replied to your note', body: 'The Hobbit (hardcover), p. 160', data: { url: `/readings/${w.bobReading.id}` }, sound: 'default' });
    expect(pushed!.badge).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(w.pushed)).not.toContain('Gollum');

    // Your own replies to your own note don't notify you.
    const before = (await bell(w.bob.browser)).items.length;
    await w.bob.browser.post(`/api/notes/${noteId}/replies`, { body: 'right?' });
    await quietly();
    expect((await bell(w.bob.browser)).items).toHaveLength(before);
  });
});

describe("clubmates' notes", () => {
  it("reach members who've read that far, bundled per book until read", async () => {
    const w = await world();
    const annPhone = phone('ann');
    await w.ann.browser.request('/api/notifications/devices', { method: 'PUT', json: { token: annPhone, platform: 'ios' } });
    await w.ann.browser.post(`/api/readings/${w.annReading.id}/progress`, { page: 150 });
    await w.bob.browser.post(`/api/readings/${w.bobReading.id}/progress`, { page: 120 });

    // Bob's note at his p. 100 (a quarter in) is behind Ann (half way): she hears. Past her place: she doesn't.
    await w.bob.browser.post('/api/notes', { readingId: w.bobReading.id, page: 100, body: 'one', visibility: 'club', clubId: w.club.id });
    await eventually(w.ann.browser, (all) => all.some((n) => n.kind === 'notes'));
    await w.bob.browser.post('/api/notes', { readingId: w.bobReading.id, page: 110, body: 'two', visibility: 'club', clubId: w.club.id });
    await w.bob.browser.post('/api/notes', { readingId: w.bobReading.id, page: 390, body: 'ahead', visibility: 'club', clubId: w.club.id });
    const items = await eventually(w.ann.browser, (all) => all.find((n) => n.kind === 'notes')?.count === 2);
    expect(items.filter((n) => n.kind === 'notes')).toHaveLength(1);
    expect(items.find((n) => n.kind === 'notes')).toMatchObject({ person: { name: 'Bob Member' }, book: { title: 'The Hobbit' }, url: `/readings/${w.annReading.id}` });
    // One push for the bundle, no text from the notes.
    expect(w.pushed.filter((m) => m.to === annPhone && m.body.includes('left a note'))).toHaveLength(1);
    expect(w.pushed.find((m) => m.to === annPhone)?.body).toBe("Bob Member left a note in The Hobbit, on a page you've read");

    // Read it, and the next note starts a new one.
    await w.ann.browser.post('/api/notifications/read', {});
    expect((await bell(w.ann.browser)).unread).toBe(0);
    await w.bob.browser.post('/api/notes', { readingId: w.bobReading.id, page: 115, body: 'three', visibility: 'club', clubId: w.club.id });
    const again = await eventually(w.ann.browser, (all) => all.filter((n) => n.kind === 'notes').length === 2);
    expect(again[0]).toMatchObject({ kind: 'notes', count: 1, read: false });
  });
});

describe('club news', () => {
  it('a join, a meeting set (in your own pages) and moved, a book finished, a new book', async () => {
    const w = await world();
    // Bob joined after Ann set it up.
    const joined = await eventually(w.ann.browser, (all) => all.some((n) => n.kind === 'joined'));
    expect(joined.find((n) => n.kind === 'joined')).toMatchObject({ person: { name: 'Bob Member' }, club: { name: 'Readers' }, url: `/clubs/${w.club.id}` });

    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const set = clubResponse.parse(await (await w.ann.browser.post(`/api/clubs/${w.club.id}/meetings`, { startsAt, title: 'Riddles', readToPage: 150 })).json()).club;
    const meetingId = set.currentBook!.meetings[0]!.id;
    const news = await eventually(w.bob.browser, (all) => all.some((n) => n.kind === 'meeting-set'));
    // Page 150 of the club's 300 is page 200 of Bob's 400.
    expect(news.find((n) => n.kind === 'meeting-set')?.meeting).toEqual({ startsAt, title: 'Riddles', readToPage: 200, moved: false });

    // A new title alone isn't news; a new time is.
    await w.ann.browser.request(`/api/clubs/${w.club.id}/meetings/${meetingId}`, { method: 'PUT', json: { startsAt, title: 'Riddles in the dark', readToPage: 150 } });
    await quietly();
    expect((await bell(w.bob.browser)).items.filter((n) => n.kind === 'meeting-set')).toHaveLength(1);
    const later = new Date(Date.parse(startsAt) + 60 * 60 * 1000).toISOString();
    await w.ann.browser.request(`/api/clubs/${w.club.id}/meetings/${meetingId}`, { method: 'PUT', json: { startsAt: later, title: 'Riddles in the dark', readToPage: 150 } });
    const moved = await eventually(w.bob.browser, (all) => all.some((n) => n.meeting?.moved));
    expect(moved[0]?.meeting).toMatchObject({ startsAt: later, moved: true });

    await w.bob.browser.post(`/api/readings/${w.bobReading.id}/finish`);
    const finished = await eventually(w.ann.browser, (all) => all.some((n) => n.kind === 'finished'));
    expect(finished.find((n) => n.kind === 'finished')).toMatchObject({ person: { name: 'Bob Member' }, book: { title: 'The Hobbit' } });

    // Another edition of the same book isn't news; another book is.
    await w.ann.browser.request(`/api/clubs/${w.club.id}/book`, { method: 'PUT', json: { editionId: w.hardcover } });
    await quietly();
    expect((await bell(w.bob.browser)).items.some((n) => n.kind === 'book-chosen')).toBe(false);
    await w.ann.browser.request(`/api/clubs/${w.club.id}/book`, { method: 'PUT', json: { editionId: await anEdition(newWork(), 200, 'Dune') } });
    const chosen = await eventually(w.bob.browser, (all) => all.some((n) => n.kind === 'book-chosen'));
    expect(chosen.find((n) => n.kind === 'book-chosen')).toMatchObject({ person: { name: 'Ann Owner' }, book: { title: 'Dune' } });
  });

  it("stays quiet for topics someone switched off, and between people who blocked each other", async () => {
    const w = await world();
    const settings = await w.bob.browser.request('/api/notifications/settings', { method: 'PUT', json: { club: false } });
    expect(await settings.json()).toEqual({ settings: { replies: true, meetings: true, notes: true, club: false } });
    expect(await (await w.bob.browser.request('/api/notifications/settings')).json()).toEqual({ settings: { replies: true, meetings: true, notes: true, club: false } });
    await w.ann.browser.post(`/api/clubs/${w.club.id}/meetings`, { startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), title: 'One' });
    await quietly();
    expect((await bell(w.bob.browser)).items).toEqual([]);

    // Ann blocks Bob: his finishing doesn't reach her.
    await w.ann.browser.request(`/api/blocks/${w.bob.userId}`, { method: 'PUT' });
    await w.bob.browser.post(`/api/readings/${w.bobReading.id}/finish`);
    await quietly();
    expect((await bell(w.ann.browser)).items.some((n) => n.kind === 'finished')).toBe(false);
  });
});

describe('meeting reminders', () => {
  it("go out once, the day before, with where to read up to in each member's pages", async () => {
    const w = await world();
    const bobPhone = phone('bob');
    await w.bob.browser.request('/api/notifications/devices', { method: 'PUT', json: { token: bobPhone, platform: 'ios', timeZone: 'Europe/Stockholm' } });
    const startsAt = new Date(Date.now() + 20 * 60 * 60 * 1000);
    await w.ann.browser.post(`/api/clubs/${w.club.id}/meetings`, { startsAt: startsAt.toISOString(), title: 'Riddles', readToPage: 150 });

    // Just set: its own news has gone out, so no reminder yet.
    await w.notifications.remindMeetings(new Date());
    await quietly();
    expect((await bell(w.bob.browser)).items.some((n) => n.kind === 'meeting-soon')).toBe(false);

    // Two hours on: the reminder, once.
    const now = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await w.notifications.remindMeetings(now);
    await w.notifications.remindMeetings(now);
    const soon = (await bell(w.bob.browser)).items.filter((n) => n.kind === 'meeting-soon');
    expect(soon).toHaveLength(1);
    expect(soon[0]).toMatchObject({ club: { name: 'Readers' }, meeting: { title: 'Riddles', readToPage: 200 }, url: `/clubs/${w.club.id}` });
    const pushed = w.pushed.filter((m) => m.to === bobPhone && m.title.startsWith('Readers meets'));
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({ title: `Readers meets ${formatSoon(startsAt, now, 'Europe/Stockholm')}`, body: 'Riddles · read up to p. 200' });
  });

  it('say today or tomorrow in the phone’s own time zone', () => {
    const now = new Date('2026-10-14T20:00:00Z');
    // Stockholm is on summer time (UTC+2) until late October; New York on UTC-4.
    expect(formatSoon(new Date('2026-10-14T22:30:00Z'), now, 'Europe/Stockholm')).toBe('tomorrow at 00:30');
    expect(formatSoon(new Date('2026-10-14T22:30:00Z'), now, 'America/New_York')).toBe('today at 18:30');
    expect(formatSoon(new Date('2026-10-15T17:00:00Z'), now, 'Not/AZone')).toMatch(/^(today|tomorrow) at \d\d:\d\d$/);
  });
});

describe('phones and the bell', () => {
  it('keeps one phone per token, drops dead ones and lets go on sign-out', async () => {
    const w = await world();
    expect((await w.bob.browser.request('/api/notifications/devices', { method: 'PUT', json: { token: 'not a token', platform: 'ios' } })).status).toBe(400);
    const dead = phone('Dead');
    await w.ann.browser.request('/api/notifications/devices', { method: 'PUT', json: { token: dead, platform: 'ios' } });
    // The same phone, now signed in as Bob: it's his.
    await w.bob.browser.request('/api/notifications/devices', { method: 'PUT', json: { token: dead, platform: 'ios' } });
    expect((await database.db.select().from(pushToken).where(eq(pushToken.token, dead)))[0]?.userId).toBe(w.bob.userId);
    await w.ann.browser.post(`/api/clubs/${w.club.id}/meetings`, { startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), title: 'One' });
    await eventually(w.bob.browser, (all) => all.some((n) => n.kind === 'meeting-set'));
    for (let i = 0; i < 50 && (await database.db.select().from(pushToken).where(eq(pushToken.token, dead))).length > 0; i++) await quietly();
    expect(await database.db.select().from(pushToken).where(eq(pushToken.token, dead))).toEqual([]);

    const mine = phone('bob');
    await w.bob.browser.request('/api/notifications/devices', { method: 'PUT', json: { token: mine, platform: 'ios' } });
    expect((await w.bob.browser.request(`/api/notifications/devices/${encodeURIComponent(mine)}`, { method: 'DELETE' })).status).toBe(204);
    expect(await database.db.select().from(pushToken).where(eq(pushToken.token, mine))).toEqual([]);
  });

  it('marks some or all read, and needs a signed-in user', async () => {
    const w = await world();
    const items = await eventually(w.ann.browser, (all) => all.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await w.ann.browser.post('/api/notifications/read', { ids: [items[0]!.id] });
    // Read now, and still when it happened.
    expect((await bell(w.ann.browser)).items[0]).toMatchObject({ id: items[0]!.id, read: true, at: items[0]!.at });
    expect((await new Browser(w.app, w.env.APP_URL).request('/api/notifications')).status).toBe(401);
  });
});
