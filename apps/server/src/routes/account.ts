import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Auth } from '../auth';
import type { Db } from '../db/client';
import { account, session } from '../db/schema';
import { requireSession, type SignedInEnv } from '../session';

/**
 * Everything stored about a user, as JSON (GDPR access and portability). Each later step adds its own
 * section (clubs, progress, notes). Secrets are never included: no password hashes, tokens or session keys.
 */
export async function exportUserData(db: Db, user: SignedInEnv['Variables']['user'], currentSessionId: string) {
  const methods = await db
    .select({ provider: account.providerId, connectedAt: account.createdAt })
    .from(account)
    .where(eq(account.userId, user.id));
  const sessions = await db
    .select({ id: session.id, createdAt: session.createdAt, expiresAt: session.expiresAt, ipAddress: session.ipAddress, userAgent: session.userAgent })
    .from(session)
    .where(eq(session.userId, user.id));
  return {
    format: 'bookclub-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailConfirmed: user.emailVerified,
      image: user.image ?? null,
      createdAt: user.createdAt,
    },
    signInMethods: methods.map((m) => ({ method: m.provider === 'credential' ? 'password' : m.provider, connectedAt: m.connectedAt })),
    signedInDevices: sessions.map(({ id, ...rest }) => ({ ...rest, thisDevice: id === currentSessionId })),
  };
}

export function accountRoutes({ auth, db }: { auth: Auth; db: Db }) {
  return new Hono<SignedInEnv>().use(requireSession(auth)).get('/export', async (c) => {
    const data = await exportUserData(db, c.get('user'), c.get('session').id);
    const date = new Date().toISOString().slice(0, 10);
    c.header('Content-Disposition', `attachment; filename="bookclub-data-${date}.json"`);
    c.header('Cache-Control', 'no-store');
    return c.json(data);
  });
}
