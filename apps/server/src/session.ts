import { createMiddleware } from 'hono/factory';
import type { Auth } from './auth';

type SessionResult = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;
export type SessionUser = SessionResult['user'];
export type SessionInfo = SessionResult['session'];

/** Variables available to routes behind `requireSession`. */
export interface SignedInEnv {
  Variables: { user: SessionUser; session: SessionInfo };
}

/** Answers 401 unless the request carries a valid session; otherwise exposes user and session. */
export function requireSession(auth: Auth) {
  return createMiddleware<SignedInEnv>(async (c, next) => {
    const result = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!result) return c.json({ error: 'unauthorized' }, 401);
    c.set('user', result.user);
    c.set('session', result.session);
    await next();
  });
}
