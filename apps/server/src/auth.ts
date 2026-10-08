import { MAX_NAME_LENGTH, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@bookclub/shared';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { haveIBeenPwned } from 'better-auth/plugins/haveibeenpwned';
import type { Logger } from 'pino';
import type { Db } from './db/client';
import * as schema from './db/schema';
import { sendInBackground, type Mailer } from './email/mailer';
import { accountDeletedMessage, existingAccountMessage, resetPasswordMessage, verifyEmailMessage } from './email/messages';
import type { Env } from './env';

const DAY = 60 * 60 * 24;

/** Display names are shown to other members: trimmed, capped, never empty. */
export function cleanName(name: string | undefined, email: string): string {
  const trimmed = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || email.split('@')[0] || 'Reader';
}

export function createAuth({ env, db, mailer, log }: { env: Env; db: Db; mailer: Mailer; log: Logger }) {
  return betterAuth({
    appName: 'Bookclub',
    baseURL: env.PUBLIC_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    // Where sign-in may redirect back to (the web app), and which browser origins may call it.
    trustedOrigins: [...new Set([env.APP_URL, env.PUBLIC_URL, ...env.CORS_ORIGINS])],
    database: drizzleAdapter(db, { provider: 'pg', schema }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        sendInBackground(mailer, log, resetPasswordMessage({ to: user.email, name: user.name, url }));
      },
      // Signing up with a taken address answers exactly like a new sign-up (so nobody can probe which
      // addresses have accounts); the real owner gets a note pointing them to sign in instead.
      onExistingUserSignUp: async ({ user }) => {
        const url = `${env.APP_URL}/sign-in?email=${encodeURIComponent(user.email)}`;
        sendInBackground(mailer, log, existingAccountMessage({ to: user.email, name: user.name, url }));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Signing in before confirming sends a fresh link (the old one may have expired).
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: DAY,
      sendVerificationEmail: async ({ user, url }) => {
        sendInBackground(mailer, log, verifyEmailMessage({ to: user.email, name: user.name, url }));
      },
    },

    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' } }
        : {},
    account: {
      // Google sign-in joins an existing account with the same address, but only one whose email was
      // confirmed (Better Auth's default), so an unconfirmed sign-up can't capture someone's Google login.
      accountLinking: { enabled: true },
    },

    session: {
      expiresIn: 30 * DAY,
      updateAge: DAY,
      // Deleting an account without a password (Google-only) needs a sign-in within this window.
      freshAge: DAY,
    },

    user: {
      deleteUser: {
        enabled: true,
        // Rows owned by the user (sessions, sign-in methods) go with it through ON DELETE CASCADE.
        // Clubs they own are handed over in the clubs step.
        afterDelete: async (user) => {
          sendInBackground(mailer, log, accountDeletedMessage({ to: user.email, name: user.name }));
        },
      },
    },

    databaseHooks: {
      user: {
        create: { before: async (user) => ({ data: { ...user, name: cleanName(user.name, user.email) } }) },
        update: {
          before: async (user) =>
            user.name === undefined ? { data: user } : { data: { ...user, name: cleanName(user.name, user.email ?? '') } },
        },
      },
    },

    rateLimit: {
      enabled: env.RATE_LIMIT,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60 * 10, max: 5 },
        '/request-password-reset': { window: 60 * 10, max: 3 },
        '/send-verification-email': { window: 60 * 10, max: 3 },
        '/reset-password': { window: 60 * 10, max: 5 },
      },
    },
    advanced: {
      // Better Auth skips origin and redirect checks when NODE_ENV=test; keep them on so tests see
      // exactly what production does.
      disableOriginCheck: false,
      // The shared Caddy proxy replaces X-Forwarded-For with the real client address.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      useSecureCookies: env.PUBLIC_URL.startsWith('https://'),
    },

    plugins: env.PASSWORD_BREACH_CHECK ? [haveIBeenPwned()] : [],
  });
}

export type Auth = ReturnType<typeof createAuth>;
