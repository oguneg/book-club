import { randomUUID } from 'node:crypto';
import { activityResponse, clubResponse, readingResponse, type ActivityItem } from '@bookclub/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './db/client';
import { edition } from './db/schema';
import { Browser, captureMailer, signedInUser, testApp, testDatabase } from './test/helpers';

let database: Database;

beforeAll(async () => {
  database = await testDatabase();
});

afterAll(async () => {
  await database?.close();
});

const newWork = () => `OL${Math.floor(Math.random() * 1e9)}W`;

async function anEdition(workKey: string, pageCount: number, cover: string | null = null) {
  const id = randomUUID();
  await database.db.insert(edition).values({ id, source: 'manual', title: 'The Hobbit', authors: ['J.R.R. Tolkien'], pageCount, workKey, cover });
  return id;
}

/** Ann's club reads a book: Ann and Bob in it, Cat outside. */
async function world() {
  const mail = captureMailer();
  const ctx = testApp(database, {}, mail.mailer);
  const user = (name: string) => signedInUser(ctx.app, ctx.env.APP_URL, mail, name);
  const work = newWork();
  const paperback = await anEdition(work, 300);
  // Another edition of the same book has the only cover: the club's book borrows it.
  await anEdition(work, 280, 'ol-1-M');
  const [ann, bob, cat] = await Promise.all([user('Ann Reader'), user('Bob Clubmate'), user('Cat Outsider')]);
  const club = clubResponse.parse(await (await ann.browser.post('/api/clubs', { name: 'Readers' })).json()).club;
  await bob.browser.post(`/api/invites/${club.inviteCode}/join`);
  await ann.browser.request(`/api/clubs/${club.id}/book`, { method: 'PUT', json: { editionId: paperback } });
  const read = async (b: Browser) => readingResponse.parse(await (await b.post('/api/readings', { editionId: paperback, startPage: 1, endPage: 300 })).json()).reading;
  return { ...ctx, ann, bob, cat, club, annReading: await read(ann.browser), bobReading: await read(bob.browser), otherBook: await anEdition(newWork(), 200) };
}

async function activity(browser: Browser): Promise<ActivityItem[]> {
  const res = await browser.request('/api/activity');
  expect(res.status).toBe(200);
  return activityResponse.parse(await res.json()).items;
}

describe('Home: what happened in your clubs', () => {
  it('shows a clubmate joining, reading and finishing the club book, and nothing of yours', async () => {
    const w = await world();
    expect((await new Browser(w.app, w.env.APP_URL).request('/api/activity')).status).toBe(401);
    await w.bob.browser.post(`/api/readings/${w.bobReading.id}/progress`, { page: 31 });
    await w.ann.browser.post(`/api/readings/${w.annReading.id}/progress`, { page: 10 });

    const seen = await activity(w.ann.browser);
    expect(seen.map((i) => i.kind).sort()).toEqual(['joined', 'progress']);
    const progress = seen.find((i) => i.kind === 'progress')!;
    expect(progress).toMatchObject({ person: { name: 'Bob Clubmate' }, club: { name: 'Readers' }, pages: 31, book: { cover: 'ol-1-M' } });

    await w.bob.browser.post(`/api/readings/${w.bobReading.id}/finish`);
    const after = await activity(w.ann.browser);
    expect(after[0]).toMatchObject({ kind: 'finished', person: { name: 'Bob Clubmate' } });
    // Finishing is the news that day, not "read 270 pages".
    expect(after.filter((i) => i.kind === 'progress')).toHaveLength(0);
  });

  it('keeps what members read on their own private, and says nothing to someone in no club', async () => {
    const w = await world();
    const own = readingResponse.parse(await (await w.bob.browser.post('/api/readings', { editionId: w.otherBook, startPage: 1, endPage: 200 })).json()).reading;
    await w.bob.browser.post(`/api/readings/${own.id}/progress`, { page: 120 });
    expect((await activity(w.ann.browser)).filter((i) => i.kind === 'progress')).toHaveLength(0);
    expect(await activity(w.cat.browser)).toEqual([]);
  });

  it('shows a club note in full only once you have read that far', async () => {
    const w = await world();
    const res = await w.bob.browser.post('/api/notes', { readingId: w.bobReading.id, page: 150, body: 'The riddles!', visibility: 'club', clubId: w.club.id });
    expect(res.status).toBe(201);
    await w.bob.browser.post('/api/notes', { readingId: w.bobReading.id, page: 20, body: 'Just for me', visibility: 'private' });

    const ahead = (await activity(w.ann.browser)).filter((i) => i.kind === 'note');
    expect(ahead).toHaveLength(1);
    expect(ahead[0]).toMatchObject({ ahead: true, body: null });

    await w.ann.browser.post(`/api/readings/${w.annReading.id}/progress`, { page: 160 });
    expect((await activity(w.ann.browser)).find((i) => i.kind === 'note')).toMatchObject({ ahead: false, body: 'The riddles!' });
  });

  it('leaves out people you blocked', async () => {
    const w = await world();
    await w.bob.browser.post(`/api/readings/${w.bobReading.id}/progress`, { page: 50 });
    expect((await w.ann.browser.request(`/api/blocks/${w.bob.userId}`, { method: 'PUT' })).status).toBeLessThan(300);
    expect(await activity(w.ann.browser)).toEqual([]);
  });
});
