import { preferencesResponse } from '@bookclub/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './db/client';
import { captureMailer, signedInUser, testApp, testDatabase } from './test/helpers';

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

const fakeSocket = () => {
  const received: unknown[] = [];
  return { received, send: (data: string) => received.push(JSON.parse(data)) };
};

describe('preferences', () => {
  it("keep each reader's appearance for all their devices, and tell the others when it changes", async () => {
    const ctx = setup();
    const ann = await ctx.user('Ann Reader');
    const bob = await ctx.user('Bob Reader');
    const read = async (who: typeof ann) => preferencesResponse.parse(await (await who.browser.request('/api/preferences')).json()).appearance;
    const [annPhone, bobPhone] = [fakeSocket(), fakeSocket()];
    ctx.live.add(ann.userId, annPhone);
    ctx.live.add(bob.userId, bobPhone);

    expect(await read(ann)).toBeNull();
    const put = await ann.browser.request('/api/preferences', { method: 'PUT', json: { appearance: { style: 'playful', mode: 'dark' } } });
    expect(put.status).toBe(200);
    expect(await read(ann)).toEqual({ style: 'playful', mode: 'dark' });
    expect(annPhone.received).toContainEqual({ type: 'preferences' });
    expect(bobPhone.received).toEqual([]);

    await ann.browser.request('/api/preferences', { method: 'PUT', json: { appearance: { style: 'sleek', mode: 'system' } } });
    expect(await read(ann)).toEqual({ style: 'sleek', mode: 'system' });
    expect(await read(bob)).toBeNull();

    expect((await ann.browser.request('/api/preferences', { method: 'PUT', json: { appearance: { style: 'neon', mode: 'dark' } } })).status).toBe(400);
    expect((await ann.browser.request('/api/preferences', { method: 'PUT', json: {} })).status).toBe(400);
  });

  it('are for signed-in readers only', async () => {
    const ctx = setup();
    expect((await ctx.app.request('/api/preferences')).status).toBe(401);
  });
});
