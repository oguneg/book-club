import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanName } from './auth';
import type { Database } from './db/client';
import { user } from './db/schema';
import { Browser, captureMailer, linkIn, testApp, testDatabase, uniqueEmail } from './test/helpers';

let database: Database;
const PASSWORD = 'correct horse battery';

beforeAll(async () => {
  database = await testDatabase();
});

afterAll(async () => {
  await database?.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(vars: Record<string, string> = {}) {
  const mail = captureMailer();
  const { app, env } = testApp(database, vars, mail.mailer);
  const browser = () => new Browser(app, env.APP_URL);
  return { app, env, mail, browser };
}

/** Signs up and confirms the email, ending signed in. */
async function signUpConfirmed(ctx: ReturnType<typeof setup>, email = uniqueEmail(), name = 'Ann Reader') {
  const browser = ctx.browser();
  const res = await browser.post('/api/auth/sign-up/email', { email, password: PASSWORD, name, callbackURL: `${ctx.env.APP_URL}/` });
  expect(res.status).toBe(200);
  await browser.request(linkIn(await ctx.mail.lastTo(email)));
  return { browser, email };
}

describe('sign up with email and password', () => {
  it('requires confirming the email before signing in', async () => {
    const ctx = setup();
    const email = uniqueEmail();
    const browser = ctx.browser();

    const signUp = await browser.post('/api/auth/sign-up/email', {
      email,
      password: PASSWORD,
      name: 'Ann Reader',
      callbackURL: `${ctx.env.APP_URL}/`,
    });
    expect(signUp.status).toBe(200);
    expect(await browser.session()).toBeNull();

    const confirmation = await ctx.mail.lastTo(email);
    expect(confirmation?.subject).toBe('Confirm your email for Bookclub');
    expect(confirmation?.html).toContain('Ann Reader');

    const tooEarly = await browser.post('/api/auth/sign-in/email', { email, password: PASSWORD });
    expect(tooEarly.status).toBe(403);
    expect(((await tooEarly.json()) as { code: string }).code).toBe('EMAIL_NOT_VERIFIED');

    // Opening the link confirms the address, signs in, and returns to the app.
    const confirm = await browser.request(linkIn(confirmation));
    expect(confirm.status).toBe(302);
    expect(confirm.headers.get('location')).toBe(`${ctx.env.APP_URL}/`);
    const session = await browser.session();
    expect(session?.user).toMatchObject({ email, name: 'Ann Reader', emailVerified: true });
  });

  it('sends a fresh confirmation link when an unconfirmed user tries to sign in', async () => {
    const ctx = setup();
    const email = uniqueEmail();
    await ctx.browser().post('/api/auth/sign-up/email', { email, password: PASSWORD, name: 'Ann' });
    await ctx.mail.lastTo(email);
    const before = ctx.mail.sent.length;
    await ctx.browser().post('/api/auth/sign-in/email', { email, password: PASSWORD });
    await expect.poll(() => ctx.mail.sent.length).toBe(before + 1);
  });

  it('rejects short passwords', async () => {
    const ctx = setup();
    const res = await ctx.browser().post('/api/auth/sign-up/email', { email: uniqueEmail(), password: 'short', name: 'Ann' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('PASSWORD_TOO_SHORT');
  });

  it("doesn't reveal or duplicate an existing account", async () => {
    const ctx = setup();
    const { email } = await signUpConfirmed(ctx);
    const again = await ctx.browser().post('/api/auth/sign-up/email', { email, password: 'another password!', name: 'Mallory' });
    expect(again.status).toBe(200);
    const rows = await database.db.select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Ann Reader');
    // The real owner is told, with a way back in.
    const note = await ctx.mail.lastTo(email);
    expect(note?.subject).toBe('You already have a Bookclub account');
    expect(linkIn(note)).toBe(`${ctx.env.APP_URL}/sign-in?email=${encodeURIComponent(email)}`);
  });

  it('tidies display names', async () => {
    const ctx = setup();
    const { browser } = await signUpConfirmed(ctx, uniqueEmail(), '  Ann \n  Reader ');
    expect((await browser.session())?.user.name).toBe('Ann Reader');
    expect(cleanName('   ', 'ann.reader@example.com')).toBe('ann.reader');
    expect(cleanName('x'.repeat(100), 'a@b.c')).toHaveLength(60);
  });

  it('rejects passwords found in breaches, without sending the password', async () => {
    const ctx = setup({ PASSWORD_BREACH_CHECK: 'true' });
    const leaked = 'password1234';
    const sha1 = createHash('sha1').update(leaked).digest('hex').toUpperCase();
    const realFetch = globalThis.fetch;
    const requested: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes('pwnedpasswords.com')) return realFetch(input, init);
      requested.push(url);
      return new Response(`${sha1.slice(5)}:4242\r\n0000000000000000000000000000000000A:1`, { status: 200 });
    });

    const res = await ctx.browser().post('/api/auth/sign-up/email', { email: uniqueEmail(), password: leaked, name: 'Ann' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('PASSWORD_COMPROMISED');
    // Only the first five characters of the hash leave the server.
    expect(requested).toEqual([`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`]);
  });
});

describe('sign in and out', () => {
  it('signs in with the right password only', async () => {
    const ctx = setup();
    const { email } = await signUpConfirmed(ctx);

    const wrong = await ctx.browser().post('/api/auth/sign-in/email', { email, password: 'wrong password!!' });
    expect(wrong.status).toBe(401);

    const browser = ctx.browser();
    const right = await browser.post('/api/auth/sign-in/email', { email: email.toUpperCase(), password: PASSWORD });
    expect(right.status).toBe(200);
    expect((await browser.session())?.user.email).toBe(email);

    await browser.post('/api/auth/sign-out');
    expect(await browser.session()).toBeNull();
  });

  it('slows down password guessing', async () => {
    const ctx = setup({ RATE_LIMIT: 'true' });
    const { email } = await signUpConfirmed(ctx);
    const attacker = new Browser(ctx.app, ctx.env.APP_URL, '198.51.100.66');
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await attacker.post('/api/auth/sign-in/email', { email, password: `guess number ${i}` })).status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
    // Someone else (another address) is not affected.
    const owner = new Browser(ctx.app, ctx.env.APP_URL, '192.0.2.10');
    expect((await owner.post('/api/auth/sign-in/email', { email, password: PASSWORD })).status).toBe(200);
  });

  it('refuses requests from untrusted origins', async () => {
    const ctx = setup();
    const { email } = await signUpConfirmed(ctx);
    const evil = new Browser(ctx.app, 'https://evil.example');
    const res = await evil.post('/api/auth/sign-in/email', { email, password: PASSWORD, callbackURL: 'https://evil.example/' });
    expect(res.status).toBe(403);
  });
});

describe('forgotten password', () => {
  it('resets the password through the emailed link and signs out other sessions', async () => {
    const ctx = setup();
    const { email, browser: oldSession } = await signUpConfirmed(ctx);
    expect(await oldSession.session()).not.toBeNull();

    const browser = ctx.browser();
    const ask = await browser.post('/api/auth/request-password-reset', { email, redirectTo: `${ctx.env.APP_URL}/reset-password` });
    expect(ask.status).toBe(200);
    const message = await ctx.mail.lastTo(email);
    expect(message?.subject).toBe('Reset your Bookclub password');

    // The emailed link checks the token and hands it to the app's reset page.
    const open = await browser.request(linkIn(message));
    expect(open.status).toBe(302);
    const location = new URL(open.headers.get('location') ?? '');
    expect(location.origin + location.pathname).toBe(`${ctx.env.APP_URL}/reset-password`);
    const token = location.searchParams.get('token');
    expect(token).toBeTruthy();

    const reset = await browser.post('/api/auth/reset-password', { newPassword: 'a brand new password', token });
    expect(reset.status).toBe(200);

    expect(await oldSession.session()).toBeNull();
    expect((await ctx.browser().post('/api/auth/sign-in/email', { email, password: PASSWORD })).status).toBe(401);
    expect((await ctx.browser().post('/api/auth/sign-in/email', { email, password: 'a brand new password' })).status).toBe(200);

    // A reset link works once.
    const again = await browser.post('/api/auth/reset-password', { newPassword: 'yet another password', token });
    expect(again.status).toBe(400);
  });

  it("answers the same for unknown addresses and sends nothing", async () => {
    const ctx = setup();
    const email = uniqueEmail('nobody');
    const res = await ctx.browser().post('/api/auth/request-password-reset', { email, redirectTo: `${ctx.env.APP_URL}/reset-password` });
    expect(res.status).toBe(200);
    expect(await ctx.mail.lastTo(email)).toBeUndefined();
  });
});

describe('Google sign-in', () => {
  it('is offered when configured, sending Google back to our callback', async () => {
    const ctx = setup({ GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-secret' });
    const res = await ctx.browser().post('/api/auth/sign-in/social', { provider: 'google', callbackURL: `${ctx.env.APP_URL}/` });
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    const google = new URL(url);
    expect(google.hostname).toBe('accounts.google.com');
    expect(google.searchParams.get('client_id')).toBe('test-client.apps.googleusercontent.com');
    expect(google.searchParams.get('redirect_uri')).toBe(`${ctx.env.PUBLIC_URL}/api/auth/callback/google`);
    expect(google.searchParams.get('prompt')).toBe('select_account');
  });

  it('tells the app whether it is available', async () => {
    const on = setup({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' });
    expect(await (await on.app.request('/api/config')).json()).toEqual({ google: true });
    expect(await (await setup().app.request('/api/config')).json()).toEqual({ google: false });
  });

  it('is unavailable when not configured', async () => {
    const ctx = setup();
    const res = await ctx.browser().post('/api/auth/sign-in/social', { provider: 'google', callbackURL: `${ctx.env.APP_URL}/` });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
