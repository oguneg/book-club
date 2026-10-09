import { randomUUID } from 'node:crypto';
import { clubListResponse, clubResponse, formatInviteCode, invitePreview, type ClubDetail } from '@bookclub/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './db/client';
import { club, edition } from './db/schema';
import { Browser, captureMailer, signedInUser, testApp, testDatabase } from './test/helpers';

let database: Database;

beforeAll(async () => {
  database = await testDatabase();
});

afterAll(async () => {
  await database?.close();
});

function setup() {
  const mail = captureMailer();
  const { app, env } = testApp(database, {}, mail.mailer);
  const user = (name: string) => signedInUser(app, env.APP_URL, mail, name);
  return { app, env, mail, user, anonymous: () => new Browser(app, env.APP_URL) };
}

async function readClub(res: Response): Promise<ClubDetail> {
  return clubResponse.parse(await res.json()).club;
}

async function newClub(owner: Browser, name = 'Thursday Readers') {
  const res = await owner.post('/api/clubs', { name, description: 'Books and coffee' });
  expect(res.status).toBe(201);
  return readClub(res);
}

async function anEdition(pageCount: number | null = 320) {
  const id = randomUUID();
  await database.db.insert(edition).values({ id, source: 'manual', title: 'The Hobbit', authors: ['J.R.R. Tolkien'], pageCount });
  return id;
}

/** A club with an owner and one member who joined by invite. */
async function clubWithMember() {
  const ctx = setup();
  const owner = await ctx.user('Olivia Owner');
  const member = await ctx.user('Max Member');
  const created = await newClub(owner.browser);
  expect((await member.browser.post(`/api/invites/${created.inviteCode}/join`)).status).toBe(200);
  return { ...ctx, owner, member, clubId: created.id, code: created.inviteCode };
}

describe('creating and listing clubs', () => {
  it('makes the creator the owner, with an invite code', async () => {
    const ctx = setup();
    const owner = await ctx.user('Olivia Owner');
    const created = await newClub(owner.browser);
    expect(created).toMatchObject({ name: 'Thursday Readers', description: 'Books and coffee', myRole: 'owner', memberCap: 50, currentBook: null });
    expect(created.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(created.members).toEqual([expect.objectContaining({ userId: owner.userId, name: 'Olivia Owner', role: 'owner' })]);

    const list = clubListResponse.parse(await (await owner.browser.request('/api/clubs')).json()).clubs;
    expect(list).toEqual([expect.objectContaining({ id: created.id, role: 'owner', memberCount: 1, currentBook: null, nextMeeting: null })]);
  });

  it('validates names', async () => {
    const ctx = setup();
    const owner = await ctx.user('Olivia Owner');
    expect((await owner.browser.post('/api/clubs', { name: '   ' })).status).toBe(400);
    expect((await owner.browser.post('/api/clubs', { name: 'x'.repeat(81) })).status).toBe(400);
  });

  it('is hidden from non-members', async () => {
    const ctx = setup();
    const owner = await ctx.user('Olivia Owner');
    const stranger = await ctx.user('Sam Stranger');
    const created = await newClub(owner.browser);
    expect((await stranger.browser.request(`/api/clubs/${created.id}`)).status).toBe(404);
    expect((await stranger.browser.request(`/api/clubs/${randomUUID()}`)).status).toBe(404);
    expect((await ctx.anonymous().request(`/api/clubs/${created.id}`)).status).toBe(401);
  });
});

describe('invites', () => {
  it('previews a club to anyone holding the code, even signed out', async () => {
    const { anonymous, owner, code, clubId } = await clubWithMember();
    const res = await anonymous().request(`/api/invites/${formatInviteCode(code).toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(invitePreview.parse(await res.json())).toMatchObject({ club: { id: clubId, name: 'Thursday Readers', memberCount: 2 }, isMember: false, isFull: false });
    const own = invitePreview.parse(await (await owner.browser.request(`/api/invites/${code}`)).json());
    expect(own.isMember).toBe(true);
    expect((await anonymous().request('/api/invites/ZZZZ-ZZZZ')).status).toBe(404);
    expect((await anonymous().request('/api/invites/not-a-code')).status).toBe(404);
  });

  it('joins once, and needs a signed-in user', async () => {
    const { member, anonymous, code, clubId } = await clubWithMember();
    expect((await anonymous().post(`/api/invites/${code}/join`)).status).toBe(401);
    const again = await member.browser.post(`/api/invites/${code}/join`);
    expect(await again.json()).toEqual({ clubId });
    const detail = await readClub(await member.browser.request(`/api/clubs/${clubId}`));
    expect(detail.myRole).toBe('member');
    expect(detail.members).toHaveLength(2);
  });

  it('refuses joining a full club', async () => {
    const ctx = await clubWithMember();
    await database.db.update(club).set({ memberCap: 2 }).where(eq(club.id, ctx.clubId));
    const late = await ctx.user('Lena Late');
    const res = await late.browser.post(`/api/invites/${ctx.code}/join`);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'club_full' });
  });

  it('a new link replaces the old one', async () => {
    const ctx = await clubWithMember();
    expect((await ctx.member.browser.post(`/api/clubs/${ctx.clubId}/invite/rotate`)).status).toBe(403);
    const rotated = await readClub(await ctx.owner.browser.post(`/api/clubs/${ctx.clubId}/invite/rotate`));
    expect(rotated.inviteCode).not.toBe(ctx.code);
    const late = await ctx.user('Lena Late');
    expect((await late.browser.post(`/api/invites/${ctx.code}/join`)).status).toBe(404);
    expect((await late.browser.post(`/api/invites/${rotated.inviteCode}/join`)).status).toBe(200);
  });
});

describe('roles', () => {
  it('only admins edit the club', async () => {
    const { owner, member, clubId } = await clubWithMember();
    expect((await member.browser.request(`/api/clubs/${clubId}`, { method: 'PATCH', json: { name: 'Mine now' } })).status).toBe(403);
    await owner.browser.request(`/api/clubs/${clubId}/members/${member.userId}`, { method: 'PATCH', json: { role: 'admin' } });
    const renamed = await readClub(await member.browser.request(`/api/clubs/${clubId}`, { method: 'PATCH', json: { name: 'Thursday Readers II', description: '' } }));
    expect(renamed).toMatchObject({ name: 'Thursday Readers II', description: null, myRole: 'admin' });
  });

  it('admins remove members but not other admins; owners remove anyone else', async () => {
    const ctx = await clubWithMember();
    const admin = await ctx.user('Ada Admin');
    const third = await ctx.user('Theo Third');
    await admin.browser.post(`/api/invites/${ctx.code}/join`);
    await third.browser.post(`/api/invites/${ctx.code}/join`);
    await ctx.owner.browser.request(`/api/clubs/${ctx.clubId}/members/${admin.userId}`, { method: 'PATCH', json: { role: 'admin' } });

    expect((await ctx.member.browser.request(`/api/clubs/${ctx.clubId}/members/${third.userId}`, { method: 'DELETE' })).status).toBe(403);
    expect((await admin.browser.request(`/api/clubs/${ctx.clubId}/members/${ctx.owner.userId}`, { method: 'DELETE' })).status).toBe(403);
    const afterAdmin = await readClub(await admin.browser.request(`/api/clubs/${ctx.clubId}/members/${third.userId}`, { method: 'DELETE' }));
    expect(afterAdmin.members.map((m) => m.name)).not.toContain('Theo Third');
    expect((await third.browser.request(`/api/clubs/${ctx.clubId}`)).status).toBe(404);

    const afterOwner = await readClub(await ctx.owner.browser.request(`/api/clubs/${ctx.clubId}/members/${admin.userId}`, { method: 'DELETE' }));
    expect(afterOwner.members.map((m) => m.role)).toEqual(['owner', 'member']);
    expect((await ctx.owner.browser.request(`/api/clubs/${ctx.clubId}/members/${ctx.owner.userId}`, { method: 'DELETE' })).status).toBe(403);
  });

  it('members leave; the owner must hand over first', async () => {
    const { owner, member, clubId } = await clubWithMember();
    const ownerLeave = await owner.browser.post(`/api/clubs/${clubId}/leave`);
    expect(ownerLeave.status).toBe(409);
    expect(await ownerLeave.json()).toEqual({ error: 'owner_cannot_leave' });
    expect((await member.browser.post(`/api/clubs/${clubId}/leave`)).status).toBe(204);
    expect((await member.browser.request(`/api/clubs/${clubId}`)).status).toBe(404);
  });

  it('hands over ownership, keeping exactly one owner', async () => {
    const { owner, member, clubId } = await clubWithMember();
    expect((await member.browser.post(`/api/clubs/${clubId}/transfer`, { userId: member.userId })).status).toBe(403);
    const after = await readClub(await owner.browser.post(`/api/clubs/${clubId}/transfer`, { userId: member.userId }));
    expect(after.myRole).toBe('admin');
    expect(after.members.filter((m) => m.role === 'owner').map((m) => m.userId)).toEqual([member.userId]);
    expect((await owner.browser.post(`/api/clubs/${clubId}/leave`)).status).toBe(204);
  });

  it('only the owner deletes the club', async () => {
    const { owner, member, clubId } = await clubWithMember();
    expect((await member.browser.request(`/api/clubs/${clubId}`, { method: 'DELETE' })).status).toBe(403);
    expect((await owner.browser.request(`/api/clubs/${clubId}`, { method: 'DELETE' })).status).toBe(204);
    expect((await owner.browser.request(`/api/clubs/${clubId}`)).status).toBe(404);
  });
});

describe("the club's book", () => {
  it('admins set it; it must have a page count', async () => {
    const { owner, member, clubId } = await clubWithMember();
    const editionId = await anEdition(320);
    expect((await member.browser.request(`/api/clubs/${clubId}/book`, { method: 'PUT', json: { editionId } })).status).toBe(403);

    const noPages = await owner.browser.request(`/api/clubs/${clubId}/book`, { method: 'PUT', json: { editionId: await anEdition(null) } });
    expect(noPages.status).toBe(400);
    expect(await noPages.json()).toEqual({ error: 'edition_without_pages' });

    const set = await readClub(
      await owner.browser.request(`/api/clubs/${clubId}/book`, { method: 'PUT', json: { editionId, startDate: '2026-10-01', finishDate: '2026-11-15' } }),
    );
    expect(set.currentBook).toMatchObject({ status: 'current', startDate: '2026-10-01', finishDate: '2026-11-15', edition: { id: editionId, pageCount: 320 } });

    const list = clubListResponse.parse(await (await member.browser.request('/api/clubs')).json()).clubs;
    expect(list[0]?.currentBook).toEqual({ title: 'The Hobbit', authors: ['J.R.R. Tolkien'], cover: null, bookKey: `e:${editionId}` });
  });

  it('changes dates, rejects a finish before the start', async () => {
    const { owner, clubId } = await clubWithMember();
    await owner.browser.request(`/api/clubs/${clubId}/book`, { method: 'PUT', json: { editionId: await anEdition(), startDate: '2026-10-01' } });
    const bad = await owner.browser.request(`/api/clubs/${clubId}/book`, { method: 'PATCH', json: { finishDate: '2026-09-01' } });
    expect(bad.status).toBe(400);
    const ok = await readClub(await owner.browser.request(`/api/clubs/${clubId}/book`, { method: 'PATCH', json: { finishDate: '2026-12-01' } }));
    expect(ok.currentBook?.finishDate).toBe('2026-12-01');
    const cleared = await readClub(await owner.browser.request(`/api/clubs/${clubId}/book`, { method: 'PATCH', json: { finishDate: null } }));
    expect(cleared.currentBook?.finishDate).toBeNull();
  });

  it('finishing moves it to past books and frees the slot for the next one', async () => {
    const { owner, clubId } = await clubWithMember();
    await owner.browser.request(`/api/clubs/${clubId}/book`, { method: 'PUT', json: { editionId: await anEdition() } });
    const finished = await readClub(await owner.browser.post(`/api/clubs/${clubId}/book/finish`));
    expect(finished.currentBook).toBeNull();
    expect(finished.pastBooks).toHaveLength(1);
    expect(finished.pastBooks[0]?.finishedAt).toBeTruthy();
    expect((await owner.browser.post(`/api/clubs/${clubId}/book/finish`)).status).toBe(409);

    const next = await readClub(await owner.browser.request(`/api/clubs/${clubId}/book`, { method: 'PUT', json: { editionId: await anEdition(200) } }));
    expect(next.currentBook?.edition.pageCount).toBe(200);
    expect(next.pastBooks).toHaveLength(1);
  });
});

describe('meetings', () => {
  async function clubWithBook() {
    const ctx = await clubWithMember();
    await ctx.owner.browser.request(`/api/clubs/${ctx.clubId}/book`, { method: 'PUT', json: { editionId: await anEdition(320) } });
    return ctx;
  }
  const meetingAt = (iso: string, extra: object = {}) => ({ startsAt: iso, title: 'First meeting', location: 'Café Pascal', readToPage: 100, ...extra });

  it('need a current book', async () => {
    const { owner, clubId } = await clubWithMember();
    const res = await owner.browser.post(`/api/clubs/${clubId}/meetings`, meetingAt('2026-10-20T18:00:00+02:00'));
    expect(res.status).toBe(409);
  });

  it('are planned by admins, sorted by time, and pages must exist in the club edition', async () => {
    const { owner, member, clubId } = await clubWithBook();
    expect((await member.browser.post(`/api/clubs/${clubId}/meetings`, meetingAt('2026-10-20T18:00:00+02:00'))).status).toBe(403);
    expect((await owner.browser.post(`/api/clubs/${clubId}/meetings`, meetingAt('2026-10-20T18:00:00+02:00', { readToPage: 321 }))).status).toBe(400);
    expect((await owner.browser.post(`/api/clubs/${clubId}/meetings`, meetingAt('not a date'))).status).toBe(400);

    await owner.browser.post(`/api/clubs/${clubId}/meetings`, meetingAt('2026-11-03T18:00:00+01:00', { title: 'Second meeting', readToPage: 320 }));
    const res = await owner.browser.post(`/api/clubs/${clubId}/meetings`, meetingAt('2026-10-20T18:00:00+02:00'));
    expect(res.status).toBe(201);
    const meetings = (await readClub(res)).currentBook?.meetings ?? [];
    expect(meetings.map((m) => [m.title, m.startsAt, m.readToPage])).toEqual([
      ['First meeting', '2026-10-20T16:00:00.000Z', 100],
      ['Second meeting', '2026-11-03T17:00:00.000Z', 320],
    ]);
  });

  it('are edited and deleted within their own club only', async () => {
    const ctx = await clubWithBook();
    const created = await readClub(await ctx.owner.browser.post(`/api/clubs/${ctx.clubId}/meetings`, meetingAt('2026-10-20T18:00:00+02:00')));
    const id = created.currentBook!.meetings[0]!.id;

    const edited = await readClub(
      await ctx.owner.browser.request(`/api/clubs/${ctx.clubId}/meetings/${id}`, {
        method: 'PUT',
        json: meetingAt('2026-10-21T19:00:00+02:00', { title: 'Moved', location: null, readToPage: null }),
      }),
    );
    expect(edited.currentBook?.meetings[0]).toMatchObject({ title: 'Moved', location: null, readToPage: null, startsAt: '2026-10-21T17:00:00.000Z' });

    const other = await ctx.user('Other Owner');
    const otherClub = await newClub(other.browser, 'Other club');
    expect((await other.browser.request(`/api/clubs/${otherClub.id}/meetings/${id}`, { method: 'DELETE' })).status).toBe(404);

    const deleted = await readClub(await ctx.owner.browser.request(`/api/clubs/${ctx.clubId}/meetings/${id}`, { method: 'DELETE' }));
    expect(deleted.currentBook?.meetings).toEqual([]);
  });

  it('show as next meeting in the club list', async () => {
    const { owner, member, clubId } = await clubWithBook();
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    await owner.browser.post(`/api/clubs/${clubId}/meetings`, meetingAt(soon));
    const list = clubListResponse.parse(await (await member.browser.request('/api/clubs')).json()).clubs;
    expect(list[0]?.nextMeeting).toBe(new Date(soon).toISOString());
  });

  it('keep their pages valid when the club switches to a shorter edition', async () => {
    const ctx = await clubWithBook();
    await ctx.owner.browser.post(`/api/clubs/${ctx.clubId}/meetings`, meetingAt('2026-10-20T18:00:00+02:00', { readToPage: 300 }));
    const switched = await readClub(await ctx.owner.browser.request(`/api/clubs/${ctx.clubId}/book`, { method: 'PUT', json: { editionId: await anEdition(250) } }));
    expect(switched.currentBook?.meetings[0]?.readToPage).toBeNull();
  });
});

describe('deleting an account', () => {
  it('hands owned clubs to an admin first, then the longest-standing member', async () => {
    const ctx = await clubWithMember();
    const admin = await ctx.user('Ada Admin');
    await admin.browser.post(`/api/invites/${ctx.code}/join`);
    await ctx.owner.browser.request(`/api/clubs/${ctx.clubId}/members/${admin.userId}`, { method: 'PATCH', json: { role: 'admin' } });

    expect((await ctx.owner.browser.post('/api/auth/delete-user', { password: 'correct horse battery' })).status).toBe(200);
    const after = await readClub(await ctx.member.browser.request(`/api/clubs/${ctx.clubId}`));
    expect(after.members.map((m) => [m.name, m.role])).toEqual([
      ['Ada Admin', 'owner'],
      ['Max Member', 'member'],
    ]);
  });

  it('deletes a club nobody else is in', async () => {
    const ctx = setup();
    const owner = await ctx.user('Solo Reader');
    const created = await newClub(owner.browser);
    await owner.browser.post('/api/auth/delete-user', { password: 'correct horse battery' });
    expect(await database.db.select().from(club).where(eq(club.id, created.id))).toHaveLength(0);
  });
});
