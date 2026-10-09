import {
  createClubInput,
  meetingInput,
  normalizeInviteCode,
  roleInput,
  setClubBookInput,
  transferInput,
  updateClubBookInput,
  updateClubInput,
} from '@bookclub/shared';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import type { z } from 'zod';
import type { Auth } from '../auth';
import { ClubError, type ClubService } from '../clubs/service';
import type { LiveHub } from '../live';
import { ReadingError, type ReadingService } from '../readings/service';
import { createRateLimiter } from '../rate-limit';
import { requireSession, type SignedInEnv } from '../session';

const ID = /^[0-9a-f-]{36}$/;

async function body<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ClubError(400, 'invalid_input');
  return parsed.data;
}

function clubId(c: Context): string {
  const id = c.req.param('id') ?? '';
  if (!ID.test(id)) throw new ClubError(404, 'not_found');
  return id;
}

export function clubRoutes({ auth, clubs, readings, live }: { auth: Auth; clubs: ClubService; readings: ReadingService; live?: LiveHub }) {
  // Invite codes are guessable only by brute force; these limits make that hopeless.
  const allowPreview = createRateLimiter({ windowMs: 10 * 60_000, max: 60 });
  const allowJoin = createRateLimiter({ windowMs: 10 * 60_000, max: 20 });
  // Generous for people running a club; a script filling the database hits these first.
  const allowWrites = createRateLimiter({ windowMs: 10 * 60_000, max: 120 });
  const allowCreate = createRateLimiter({ windowMs: 24 * 60 * 60_000, max: 10 });
  const limitWrites: MiddlewareHandler<SignedInEnv> = async (c, next) => {
    if (c.req.method !== 'GET' && !allowWrites(c.get('user').id)) return c.json({ error: 'rate_limited' }, 429);
    await next();
  };
  const signedIn = requireSession(auth);

  const app = new Hono<SignedInEnv>();
  app.onError((err, c) => {
    if (err instanceof ClubError) return c.json({ error: err.code }, err.status);
    if (err instanceof ReadingError) return c.json({ error: err.code }, err.status);
    throw err;
  });

  // ---- Invites (preview works signed out, so the invite page can show the club's name) ----

  app.get('/invites/:code', async (c) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (!allowPreview(ip)) return c.json({ error: 'rate_limited' }, 429);
    const code = normalizeInviteCode(c.req.param('code'));
    if (!code) return c.json({ error: 'not_found' }, 404);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    return c.json(await clubs.previewInvite(code, session?.user.id ?? null));
  });

  app.post('/invites/:code/join', signedIn, async (c) => {
    if (!allowJoin(c.get('user').id)) return c.json({ error: 'rate_limited' }, 429);
    const code = normalizeInviteCode(c.req.param('code'));
    if (!code) return c.json({ error: 'not_found' }, 404);
    const joined = await clubs.join(code, c.get('user').id);
    void live?.clubChanged(joined.clubId).catch(() => {});
    return c.json(joined);
  });

  // ---- Clubs ----

  app.use('/clubs', signedIn, limitWrites);
  app.use('/clubs/*', signedIn, limitWrites);
  // After any successful change to a club, its members' open apps refresh it.
  app.use('/clubs/:id/*', async (c, next) => {
    await next();
    const id = c.req.param('id');
    if (c.req.method !== 'GET' && c.res.status < 400 && id && ID.test(id)) void live?.clubChanged(id).catch(() => {});
  });
  app.on(['PATCH', 'DELETE'], '/clubs/:id', async (c, next) => {
    // Notify before a delete removes the member list.
    const id = c.req.param('id');
    if (c.req.method === 'DELETE' && id && ID.test(id)) await live?.clubChanged(id).catch(() => {});
    await next();
    if (c.req.method === 'PATCH' && c.res.status < 400 && id && ID.test(id)) void live?.clubChanged(id).catch(() => {});
  });

  app.get('/clubs', async (c) => c.json({ clubs: await clubs.listForUser(c.get('user').id) }));

  app.post('/clubs', async (c) => {
    if (!allowCreate(c.get('user').id)) return c.json({ error: 'rate_limited' }, 429);
    const club = await clubs.create(c.get('user').id, await body(c, createClubInput));
    return c.json({ club }, 201);
  });

  app.get('/clubs/:id', async (c) => c.json({ club: await clubs.detail(clubId(c), c.get('user').id) }));

  app.get('/clubs/:id/progress', async (c) => c.json({ members: await readings.clubProgress(clubId(c), c.get('user').id) }));

  app.patch('/clubs/:id', async (c) => c.json({ club: await clubs.update(clubId(c), c.get('user').id, await body(c, updateClubInput)) }));

  app.delete('/clubs/:id', async (c) => {
    await clubs.remove(clubId(c), c.get('user').id);
    return c.body(null, 204);
  });

  app.post('/clubs/:id/invite/rotate', async (c) => c.json({ club: await clubs.rotateInvite(clubId(c), c.get('user').id) }));

  app.post('/clubs/:id/leave', async (c) => {
    await clubs.leave(clubId(c), c.get('user').id);
    return c.body(null, 204);
  });

  app.patch('/clubs/:id/members/:userId', async (c) => {
    const { role } = await body(c, roleInput);
    return c.json({ club: await clubs.setRole(clubId(c), c.get('user').id, c.req.param('userId'), role) });
  });

  app.delete('/clubs/:id/members/:userId', async (c) =>
    c.json({ club: await clubs.removeMember(clubId(c), c.get('user').id, c.req.param('userId')) }),
  );

  app.post('/clubs/:id/transfer', async (c) => {
    const { userId } = await body(c, transferInput);
    return c.json({ club: await clubs.transferOwnership(clubId(c), c.get('user').id, userId) });
  });

  // ---- The club's book and schedule ----

  app.put('/clubs/:id/book', async (c) => c.json({ club: await clubs.setBook(clubId(c), c.get('user').id, await body(c, setClubBookInput)) }));

  app.patch('/clubs/:id/book', async (c) =>
    c.json({ club: await clubs.updateBook(clubId(c), c.get('user').id, await body(c, updateClubBookInput)) }),
  );

  app.post('/clubs/:id/book/finish', async (c) => c.json({ club: await clubs.finishBook(clubId(c), c.get('user').id) }));

  app.post('/clubs/:id/meetings', async (c) =>
    c.json({ club: await clubs.addMeeting(clubId(c), c.get('user').id, await body(c, meetingInput)) }, 201),
  );

  app.put('/clubs/:id/meetings/:meetingId', async (c) =>
    c.json({ club: await clubs.updateMeeting(clubId(c), c.get('user').id, c.req.param('meetingId'), await body(c, meetingInput)) }),
  );

  app.delete('/clubs/:id/meetings/:meetingId', async (c) =>
    c.json({ club: await clubs.deleteMeeting(clubId(c), c.get('user').id, c.req.param('meetingId')) }),
  );

  return app;
}
