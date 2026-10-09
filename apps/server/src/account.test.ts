import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './db/client';
import { account, session, user } from './db/schema';
import { Browser, captureMailer, linkIn, testApp, testDatabase, uniqueEmail } from './test/helpers';

let database: Database;
const PASSWORD = 'correct horse battery';

beforeAll(async () => {
  database = await testDatabase();
});

afterAll(async () => {
  await database?.close();
});

function setup() {
  const mail = captureMailer();
  const { app, env } = testApp(database, {}, mail.mailer);
  return { app, env, mail, browser: () => new Browser(app, env.APP_URL) };
}

async function signedInUser(ctx: ReturnType<typeof setup>, name = 'Ann Reader') {
  const email = uniqueEmail();
  const browser = ctx.browser();
  await browser.post('/api/auth/sign-up/email', { email, password: PASSWORD, name, callbackURL: `${ctx.env.APP_URL}/` });
  await browser.request(linkIn(await ctx.mail.lastTo(email)));
  const current = await browser.session();
  if (!current) throw new Error('not signed in');
  return { browser, email, userId: current.user.id };
}

async function signIn(ctx: ReturnType<typeof setup>, email: string, password = PASSWORD) {
  const browser = ctx.browser();
  const res = await browser.post('/api/auth/sign-in/email', { email, password });
  return { browser, status: res.status };
}

describe('download my data', () => {
  it('needs a signed-in user', async () => {
    const ctx = setup();
    expect((await ctx.browser().request('/api/account/export')).status).toBe(401);
  });

  it('returns the profile, sign-in methods and devices as a file, without secrets', async () => {
    const ctx = setup();
    const { browser, email } = await signedInUser(ctx);
    await signIn(ctx, email); // a second device

    const res = await browser.request('/api/account/export');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="bookclub-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get('cache-control')).toBe('no-store');

    const text = await res.text();
    const data = JSON.parse(text);
    expect(data.profile).toMatchObject({ name: 'Ann Reader', email, emailConfirmed: true });
    expect(data.signInMethods).toEqual([{ method: 'password', connectedAt: expect.any(String) }]);
    expect(data.signedInDevices).toHaveLength(2);
    expect(data.signedInDevices.filter((d: { thisDevice: boolean }) => d.thisDevice)).toHaveLength(1);
    expect(data).toMatchObject({ clubs: [], readings: [], notes: [], reactions: [], reports: [], blocked: [] });

    const [stored] = await database.db
      .select({ hash: account.password })
      .from(account)
      .innerJoin(user, eq(user.id, account.userId))
      .where(and(eq(account.providerId, 'credential'), eq(user.email, email)));
    const tokens = await database.db.select({ token: session.token }).from(session).innerJoin(user, eq(user.id, session.userId)).where(eq(user.email, email));
    expect(stored?.hash).toBeTruthy();
    expect(text).not.toContain(stored?.hash);
    for (const { token } of tokens) expect(text).not.toContain(token);
  });

  it('allows a few exports an hour', async () => {
    const ctx = setup();
    const { browser } = await signedInUser(ctx);
    for (let i = 0; i < 5; i++) expect((await browser.request('/api/account/export')).status).toBe(200);
    expect((await browser.request('/api/account/export')).status).toBe(429);
  });
});

describe('profile', () => {
  it('lets users change their display name, tidied like at sign-up', async () => {
    const ctx = setup();
    const { browser } = await signedInUser(ctx);
    const res = await browser.post('/api/auth/update-user', { name: '  Ann   B. Reader ' });
    expect(res.status).toBe(200);
    expect((await browser.session())?.user.name).toBe('Ann B. Reader');
  });
});

describe('change password', () => {
  it('needs the current password', async () => {
    const ctx = setup();
    const { browser } = await signedInUser(ctx);
    const res = await browser.post('/api/auth/change-password', { currentPassword: 'not my password', newPassword: 'a whole new password' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('INVALID_PASSWORD');
  });

  it('changes it and signs out other devices, keeping this one', async () => {
    const ctx = setup();
    const { browser, email } = await signedInUser(ctx);
    const { browser: otherDevice } = await signIn(ctx, email);
    expect(await otherDevice.session()).not.toBeNull();

    const res = await browser.post('/api/auth/change-password', {
      currentPassword: PASSWORD,
      newPassword: 'a whole new password',
      revokeOtherSessions: true,
    });
    expect(res.status).toBe(200);
    expect(await browser.session()).not.toBeNull();
    expect(await otherDevice.session()).toBeNull();
    expect((await signIn(ctx, email)).status).toBe(401);
    expect((await signIn(ctx, email, 'a whole new password')).status).toBe(200);
  });
});

describe('sign out other devices', () => {
  it('keeps only this device signed in', async () => {
    const ctx = setup();
    const { browser, email } = await signedInUser(ctx);
    const { browser: otherDevice } = await signIn(ctx, email);
    expect((await browser.post('/api/auth/revoke-other-sessions')).status).toBe(200);
    expect(await browser.session()).not.toBeNull();
    expect(await otherDevice.session()).toBeNull();
  });
});

describe('add a password to a Google-only account', () => {
  it('works through the reset-password email', async () => {
    const ctx = setup();
    const email = uniqueEmail('google');
    const userId = randomUUID();
    await database.db.insert(user).values({ id: userId, name: 'Gee Reader', email, emailVerified: true });
    await database.db.insert(account).values({ id: randomUUID(), userId, providerId: 'google', accountId: `google-${userId}` });

    const browser = ctx.browser();
    await browser.post('/api/auth/request-password-reset', { email, redirectTo: `${ctx.env.APP_URL}/reset-password` });
    const open = await browser.request(linkIn(await ctx.mail.lastTo(email)));
    const token = new URL(open.headers.get('location') ?? '').searchParams.get('token');
    expect((await browser.post('/api/auth/reset-password', { newPassword: 'my first password', token })).status).toBe(200);

    expect((await signIn(ctx, email, 'my first password')).status).toBe(200);
    const methods = await database.db.select({ provider: account.providerId }).from(account).where(eq(account.userId, userId));
    expect(methods.map((m) => m.provider).sort()).toEqual(['credential', 'google']);
  });
});

describe('delete my account', () => {
  it('refuses a wrong password', async () => {
    const ctx = setup();
    const { browser, userId } = await signedInUser(ctx);
    const res = await browser.post('/api/auth/delete-user', { password: 'not my password' });
    expect(res.status).toBe(400);
    expect(await database.db.select().from(user).where(eq(user.id, userId))).toHaveLength(1);
  });

  it('deletes everything about the user and confirms by email', async () => {
    const ctx = setup();
    const { browser, email, userId } = await signedInUser(ctx);
    await signIn(ctx, email); // another device

    const res = await browser.post('/api/auth/delete-user', { password: PASSWORD });
    expect(res.status).toBe(200);

    expect(await database.db.select().from(user).where(eq(user.id, userId))).toHaveLength(0);
    expect(await database.db.select().from(account).where(eq(account.userId, userId))).toHaveLength(0);
    expect(await database.db.select().from(session).where(eq(session.userId, userId))).toHaveLength(0);
    expect(await browser.session()).toBeNull();
    expect((await signIn(ctx, email)).status).toBe(401);
    expect((await ctx.mail.lastTo(email))?.subject).toBe('Your Bookclub account was deleted');
  });

  it('without a password, needs a recent sign-in', async () => {
    const ctx = setup();
    const { browser, userId } = await signedInUser(ctx);
    // Pretend this sign-in happened two days ago.
    await database.db.update(session).set({ createdAt: sql`now() - interval '2 days'` }).where(eq(session.userId, userId));
    const stale = await browser.post('/api/auth/delete-user', {});
    expect(stale.status).toBe(400);
    expect(((await stale.json()) as { code: string }).code).toBe('SESSION_EXPIRED');

    await database.db.update(session).set({ createdAt: sql`now()` }).where(eq(session.userId, userId));
    expect((await browser.post('/api/auth/delete-user', {})).status).toBe(200);
    expect(await database.db.select().from(user).where(eq(user.id, userId))).toHaveLength(0);
  });
});
