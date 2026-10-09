import { Hono, type MiddlewareHandler } from 'hono';
import type { Auth } from '../auth';
import type { Env } from '../env';
import { NoteError, type NoteService } from '../notes/service';
import { requireSession, type SignedInEnv } from '../session';

const ID = /^[0-9a-f-]{36}$/;

/** Whether this user reviews reported notes: listed in ADMIN_EMAILS, with a confirmed address. */
export function isModerator(env: Pick<Env, 'ADMIN_EMAILS'>, user: { email: string; emailVerified: boolean }): boolean {
  return user.emailVerified && env.ADMIN_EMAILS.includes(user.email.toLowerCase());
}

/** Moderation for the people in ADMIN_EMAILS. To everyone else these routes don't exist (404). */
export function adminRoutes({ auth, env, notes }: { auth: Auth; env: Env; notes: NoteService }) {
  const moderatorsOnly: MiddlewareHandler<SignedInEnv> = async (c, next) => {
    if (!isModerator(env, c.get('user'))) return c.json({ error: 'not_found' }, 404);
    await next();
  };
  const signedIn = requireSession(auth);

  const app = new Hono<SignedInEnv>();
  app.use('/admin', signedIn, moderatorsOnly);
  app.use('/admin/*', signedIn, moderatorsOnly);
  app.onError((err, c) => {
    if (err instanceof NoteError) return c.json({ error: err.code }, err.status);
    throw err;
  });

  const noteId = (id: string | undefined) => {
    if (!id || !ID.test(id)) throw new NoteError(404, 'not_found');
    return id;
  };

  // Lets the app show its moderation link.
  app.get('/admin', (c) => c.json({ moderator: true }));

  app.get('/admin/reports', async (c) => c.json({ notes: await notes.reportQueue() }));

  app.post('/admin/reports/:id/dismiss', async (c) => {
    await notes.dismissReports(noteId(c.req.param('id')));
    return c.body(null, 204);
  });

  app.post('/admin/reports/:id/remove', async (c) => {
    await notes.removeReported(noteId(c.req.param('id')));
    return c.body(null, 204);
  });

  return app;
}
