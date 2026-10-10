import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { clubProgressResponse, clubResponse, readingListResponse, readingResponse, readingStatsResponse, wantToReadListResponse, wantToReadResponse, type ReadingDetail } from '@bookclub/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { Database } from './db/client';
import { edition, progressEvent } from './db/schema';
import { attachLive, MAX_SOCKETS_PER_USER } from './live';
import { Browser, captureMailer, log, signedInUser, testApp, testDatabase } from './test/helpers';

let database: Database;

beforeAll(async () => {
  database = await testDatabase();
});

afterAll(async () => {
  await database?.close();
});

function setup() {
  const mail = captureMailer();
  const ctx = testApp(database, {}, mail.mailer);
  return { ...ctx, user: (name: string) => signedInUser(ctx.app, ctx.env.APP_URL, mail, name) };
}

/** An edition of a (test-unique) work; several editions of one work count as the same book. */
async function anEdition(workKey: string | null, pageCount = 300, title = 'The Hobbit') {
  const id = randomUUID();
  await database.db.insert(edition).values({ id, source: 'manual', title, authors: ['J.R.R. Tolkien'], pageCount, workKey });
  return id;
}
const newWork = () => `OL${Math.floor(Math.random() * 1e9)}W`;

async function start(browser: Browser, editionId: string, startPage = 1, endPage = 300): Promise<ReadingDetail> {
  const res = await browser.post('/api/readings', { editionId, startPage, endPage });
  expect(res.status).toBe(201);
  return readingResponse.parse(await res.json()).reading;
}

async function logPage(browser: Browser, id: string, body: object) {
  return browser.post(`/api/readings/${id}/progress`, body);
}

describe('reading on your own', () => {
  it('starts a reading and logs pages or percentages', async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const r = await start(ann.browser, await anEdition(newWork()), 11, 310);
    expect(r).toMatchObject({ position: 0, currentPage: null, status: 'reading', startPage: 11, endPage: 310 });

    const byPage = readingResponse.parse(await (await logPage(ann.browser, r.id, { page: 130 })).json()).reading;
    expect(byPage).toMatchObject({ position: 4000, currentPage: 130 });

    const byPercent = readingResponse.parse(await (await logPage(ann.browser, r.id, { percent: 50 })).json()).reading;
    expect(byPercent).toMatchObject({ position: 5000, currentPage: 160 });

    expect((await logPage(ann.browser, r.id, { page: 311 })).status).toBe(400);
    const beforeStory = readingResponse.parse(await (await logPage(ann.browser, r.id, { page: 3 })).json()).reading;
    expect(beforeStory.position).toBe(0);
  });

  it('merges quick corrections into one history entry', async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const r = await start(ann.browser, await anEdition(newWork()));
    await logPage(ann.browser, r.id, { page: 50 });
    const corrected = readingResponse.parse(await (await logPage(ann.browser, r.id, { page: 60 })).json()).reading;
    expect(corrected.history.map((h) => h.page)).toEqual([60]);

    // An hour later, a new entry.
    await database.db.update(progressEvent).set({ createdAt: sql`now() - interval '1 hour'` }).where(eq(progressEvent.readingId, r.id));
    const later = readingResponse.parse(await (await logPage(ann.browser, r.id, { page: 90 })).json()).reading;
    expect(later.history.map((h) => h.page)).toEqual([60, 90]);
  });

  it('one active reading per book, across editions; rereading after finishing is fine', async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const work = newWork();
    const first = await start(ann.browser, await anEdition(work));

    const twice = await ann.browser.post('/api/readings', { editionId: await anEdition(work, 400), startPage: 1, endPage: 400 });
    expect(twice.status).toBe(409);
    expect(await twice.json()).toEqual({ error: 'already_reading', readingId: first.id });
    await start(ann.browser, await anEdition(newWork()));

    const finished = readingResponse.parse(await (await ann.browser.post(`/api/readings/${first.id}/finish`)).json()).reading;
    expect(finished).toMatchObject({ status: 'finished', position: 10000, currentPage: 300 });
    expect(finished.finishedAt).toBeTruthy();
    expect((await logPage(ann.browser, first.id, { page: 10 })).status).toBe(409);
    await start(ann.browser, await anEdition(work));
  });

  it('stops, resumes and removes', async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const r = await start(ann.browser, await anEdition(newWork()));
    const stopped = readingResponse.parse(await (await ann.browser.post(`/api/readings/${r.id}/stop`)).json()).reading;
    expect(stopped.status).toBe('stopped');
    const resumed = readingResponse.parse(await (await ann.browser.post(`/api/readings/${r.id}/resume`)).json()).reading;
    expect(resumed.status).toBe('reading');
    expect((await ann.browser.request(`/api/readings/${r.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await ann.browser.request(`/api/readings/${r.id}`)).status).toBe(404);
  });

  it('switches to another edition of the same book, keeping the place', async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const work = newWork();
    const r = await start(ann.browser, await anEdition(work, 300));
    await logPage(ann.browser, r.id, { page: 150 });
    const hardcover = await anEdition(work, 400);
    const switched = readingResponse.parse(
      await (await ann.browser.request(`/api/readings/${r.id}`, { method: 'PATCH', json: { editionId: hardcover, endPage: 400 } })).json(),
    ).reading;
    expect(switched).toMatchObject({ position: 5000, currentPage: 200, endPage: 400, edition: { id: hardcover } });

    const other = await anEdition(newWork());
    const wrong = await ann.browser.request(`/api/readings/${r.id}`, { method: 'PATCH', json: { editionId: other } });
    expect(await wrong.json()).toEqual({ error: 'different_book' });
  });

  it('lists the shelf: reading first, then finished', async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const done = await start(ann.browser, await anEdition(newWork(), 300, 'Finished Book'));
    await ann.browser.post(`/api/readings/${done.id}/finish`);
    await start(ann.browser, await anEdition(newWork(), 300, 'Current Book'));
    const shelf = readingListResponse.parse(await (await ann.browser.request('/api/readings')).json()).readings;
    expect(shelf.map((r) => [r.edition.title, r.status])).toEqual([
      ['Current Book', 'reading'],
      ['Finished Book', 'finished'],
    ]);
  });

  it("keeps readings private", async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const bob = await ctx.user('Bob Other');
    const r = await start(ann.browser, await anEdition(newWork()));
    expect((await bob.browser.request(`/api/readings/${r.id}`)).status).toBe(404);
    expect((await logPage(bob.browser, r.id, { page: 10 })).status).toBe(404);
    expect((await ctx.app.request('/api/readings')).status).toBe(401);
  });
});

describe("a club's progress", () => {
  async function clubReading(work: string) {
    const ctx = setup();
    const owner = await ctx.user('Olivia Owner');
    const member = await ctx.user('Max Member');
    const club = clubResponse.parse(await (await owner.browser.post('/api/clubs', { name: 'Thursday Readers' })).json()).club;
    await member.browser.post(`/api/invites/${club.inviteCode}/join`);
    await owner.browser.request(`/api/clubs/${club.id}/book`, { method: 'PUT', json: { editionId: await anEdition(work, 320) } });
    return { ...ctx, owner, member, clubId: club.id };
  }

  it("shows each member's reading of the club book, whatever their edition", async () => {
    const work = newWork();
    const ctx = await clubReading(work);
    const own = await start(ctx.owner.browser, await anEdition(work, 400), 1, 400);
    await logPage(ctx.owner.browser, own.id, { page: 100 });
    // A reading of some other book doesn't count.
    await start(ctx.member.browser, await anEdition(newWork()));

    const res = await ctx.member.browser.request(`/api/clubs/${ctx.clubId}/progress`);
    const { members } = clubProgressResponse.parse(await res.json());
    expect(members.map((m) => [m.name, m.reading?.position ?? null, m.reading?.currentPage ?? null])).toEqual([
      ['Olivia Owner', 2500, 100],
      ['Max Member', null, null],
    ]);
    expect(members[0]?.reading?.history).toHaveLength(1);

    const stranger = await ctx.user('Sam Stranger');
    expect((await stranger.browser.request(`/api/clubs/${ctx.clubId}/progress`)).status).toBe(404);
  });

  it('is empty without a club book', async () => {
    const ctx = setup();
    const owner = await ctx.user('Olivia Owner');
    const club = clubResponse.parse(await (await owner.browser.post('/api/clubs', { name: 'No book yet' })).json()).club;
    const { members } = clubProgressResponse.parse(await (await owner.browser.request(`/api/clubs/${club.id}/progress`)).json());
    expect(members).toEqual([{ userId: expect.any(String), name: 'Olivia Owner', reading: null }]);
  });
});

describe('live updates', () => {
  const fakeSocket = () => {
    const received: unknown[] = [];
    return { received, send: (data: string) => received.push(JSON.parse(data)) };
  };

  it("tell the reader's other devices and the club's members when progress is logged", async () => {
    const work = newWork();
    const ctx = setup();
    const owner = await ctx.user('Olivia Owner');
    const member = await ctx.user('Max Member');
    const outsider = await ctx.user('Sam Stranger');
    const club = clubResponse.parse(await (await owner.browser.post('/api/clubs', { name: 'Live club' })).json()).club;
    await member.browser.post(`/api/invites/${club.inviteCode}/join`);
    await owner.browser.request(`/api/clubs/${club.id}/book`, { method: 'PUT', json: { editionId: await anEdition(work) } });

    const [ownerPhone, memberLaptop, outsiderLaptop] = [fakeSocket(), fakeSocket(), fakeSocket()];
    ctx.live.add(owner.userId, ownerPhone);
    ctx.live.add(member.userId, memberLaptop);
    ctx.live.add(outsider.userId, outsiderLaptop);

    const r = await start(member.browser, await anEdition(work));
    await logPage(member.browser, r.id, { page: 42 });
    expect(memberLaptop.received).toContainEqual({ type: 'readings' });
    expect(ownerPhone.received).toContainEqual({ type: 'club-progress', clubId: club.id });
    expect(ownerPhone.received).not.toContainEqual({ type: 'readings' });
    expect(outsiderLaptop.received).toEqual([]);

    await owner.browser.request(`/api/clubs/${club.id}`, { method: 'PATCH', json: { name: 'Renamed' } });
    expect(memberLaptop.received).toContainEqual({ type: 'club', clubId: club.id });
  });

  it('connect over WebSocket only when signed in, from our own origin', async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const server = serve({ fetch: ctx.app.fetch, port: 0, hostname: '127.0.0.1' });
    await new Promise((resolve) => server.once('listening', resolve));
    attachLive(server, { auth: ctx.auth, hub: ctx.live, trustedOrigins: [ctx.env.APP_URL], log });
    const url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/api/live`;
    const cookie = ann.browser.cookieHeader();

    const status = (headers: Record<string, string>) =>
      new Promise<number>((resolve) => {
        const ws = new WebSocket(url, { headers });
        ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
        ws.on('open', () => {
          ws.close();
          resolve(101);
        });
        ws.on('error', () => {});
      });
    try {
      expect(await status({ Origin: ctx.env.APP_URL })).toBe(401);
      expect(await status({ Origin: 'https://evil.example', Cookie: cookie })).toBe(403);

      const ws = new WebSocket(url, { headers: { Origin: ctx.env.APP_URL, Cookie: cookie } });
      const message = new Promise<unknown>((resolve) => ws.on('message', (data) => resolve(JSON.parse(String(data)))));
      await new Promise((resolve) => ws.on('open', resolve));
      await start(ann.browser, await anEdition(newWork()));
      expect(await message).toEqual({ type: 'readings' });

      // One account can't hold open an unlimited number of sockets.
      const more = await Promise.all(
        Array.from({ length: MAX_SOCKETS_PER_USER - 1 }, async () => {
          const extra = new WebSocket(url, { headers: { Origin: ctx.env.APP_URL, Cookie: cookie } });
          await new Promise((resolve) => extra.on('open', resolve));
          return extra;
        }),
      );
      expect(await status({ Origin: ctx.env.APP_URL, Cookie: cookie })).toBe(429);
      for (const extra of more) extra.close();
      ws.close();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe('want to read', () => {
  async function wanted(browser: Browser) {
    return wantToReadListResponse.parse(await (await browser.request('/api/want-to-read')).json()).books;
  }

  it('saves books for later, one entry per book, and starting one takes it off', async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    expect((await new Browser(ctx.app, ctx.env.APP_URL).request('/api/want-to-read')).status).toBe(401);

    const work = newWork();
    const paperback = await anEdition(work, 300);
    const hardcover = await anEdition(work, 320);
    const other = await anEdition(newWork(), 200, 'Dune');

    const added = await ann.browser.post('/api/want-to-read', { editionId: paperback });
    expect(added.status).toBe(201);
    const first = wantToReadResponse.parse(await added.json()).book;
    expect(first).toMatchObject({ bookKey: `w:${work}`, edition: { id: paperback } });
    await ann.browser.post('/api/want-to-read', { editionId: other });

    // Saving another edition of the same book changes the edition, not the count.
    const again = wantToReadResponse.parse(await (await ann.browser.post('/api/want-to-read', { editionId: hardcover })).json()).book;
    expect(again).toMatchObject({ id: first.id, edition: { id: hardcover } });
    expect((await wanted(ann.browser)).map((b) => b.edition.title)).toEqual(['Dune', 'The Hobbit']);

    expect((await ann.browser.post('/api/want-to-read', { editionId: randomUUID() })).status).toBe(400);

    const reading = await start(ann.browser, paperback);
    expect((await wanted(ann.browser)).map((b) => b.edition.title)).toEqual(['Dune']);
    const whileReading = await ann.browser.post('/api/want-to-read', { editionId: hardcover });
    expect(whileReading.status).toBe(409);
    expect(await whileReading.json()).toMatchObject({ error: 'already_reading', readingId: reading.id });
  });

  it('removes only your own entries', async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const bo = await ctx.user('Bo Reader');
    const book = wantToReadResponse.parse(await (await ann.browser.post('/api/want-to-read', { editionId: await anEdition(newWork()) })).json()).book;

    expect((await bo.browser.request(`/api/want-to-read/${book.id}`, { method: 'DELETE' })).status).toBe(404);
    expect(await wanted(ann.browser)).toHaveLength(1);
    expect((await ann.browser.request(`/api/want-to-read/${book.id}`, { method: 'DELETE' })).status).toBe(204);
    expect(await wanted(ann.browser)).toHaveLength(0);
    expect((await ann.browser.request(`/api/want-to-read/${book.id}`, { method: 'DELETE' })).status).toBe(404);
  });
});

describe('reading stats', () => {
  it('counts pages read lately and books finished this year, ignoring corrections backwards', async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const r = await start(ann.browser, await anEdition(newWork(), 300), 1, 300);
    await logPage(ann.browser, r.id, { page: 30 });
    // Two logs a minute apart merge into one entry; this one corrects the last downwards.
    await logPage(ann.browser, r.id, { page: 20 });
    const other = await start(ann.browser, await anEdition(newWork(), 200, 'Dune'), 1, 200);
    await ann.browser.post(`/api/readings/${other.id}/finish`);

    const res = await ann.browser.request('/api/reading-stats');
    expect(res.status).toBe(200);
    const { stats } = readingStatsResponse.parse(await res.json());
    expect(stats.recent.map((e) => e.pages).sort((a, b) => a - b)).toEqual([20, 200]);
    expect(stats.pagesThisYear).toBe(220);
    expect(stats.finishedThisYear.map((b) => b.title)).toEqual(['Dune']);
  });
});
