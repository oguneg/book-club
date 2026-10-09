import { z } from 'zod';

const DEV_AUTH_SECRET = 'development-only-secret-never-used-on-a-server';
const deployed = (appEnv: string) => appEnv === 'staging' || appEnv === 'production';

const schema = z
  .object({
    APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(8787),
    /** Postgres connection string. Without it the server uses an embedded PGlite database (dev only). */
    DATABASE_URL: z.url().optional(),
    PGLITE_DIR: z.string().default('.data/pglite'),
    /** Built web app to serve at /. Unset in dev, where Expo serves the web app itself. */
    PUBLIC_DIR: z.string().optional(),
    GIT_COMMIT: z.string().default('dev'),
    /**
     * Comma-separated browser origins allowed to call the API cross-origin. Only needed in development,
     * where the Expo web dev server runs on its own port; in production the web app is same-origin.
     */
    CORS_ORIGINS: z
      .string()
      .optional()
      .transform((value) => value?.split(',').map((origin) => origin.trim()).filter(Boolean)),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    /** Where this server is reached from outside; links in emails and OAuth callbacks point here. */
    PUBLIC_URL: z.url().optional(),
    /** Where the web app lives. Same as PUBLIC_URL when deployed; the Expo dev server in development. */
    APP_URL: z.url().optional(),
    /** Signs sessions and tokens. At least 32 random characters on a server (openssl rand -hex 32). */
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    /** Google Books API key (ISBN lookups). Without it, ISBNs are looked up on Open Library only. */
    GOOGLE_BOOKS_API_KEY: z.string().optional(),
    /** `log` writes emails (with their links) to the server log; `resend` sends them. */
    EMAIL_TRANSPORT: z.enum(['log', 'resend']).optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('Bookclub <noreply@mail.ogun.se>'),
    /** Reject passwords found in known breaches (Have I Been Pwned, k-anonymity: the password never leaves). */
    PASSWORD_BREACH_CHECK: z.stringbool().optional(),
    RATE_LIMIT: z.stringbool().optional(),
    /** Sentry DSNs for server errors and for crashes in the app (forwarded by the server). Optional. */
    SENTRY_DSN: z.string().optional(),
    SENTRY_DSN_WEB: z.string().optional(),
    /** Comma-separated emails of the people who review reported notes (confirmed addresses only). */
    ADMIN_EMAILS: z
      .string()
      .optional()
      .transform((value) => (value ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)),
  })
  .superRefine((env, ctx) => {
    const require = (key: keyof typeof env, why: string) => {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required ${why}` });
    };
    if (deployed(env.APP_ENV)) {
      require('DATABASE_URL', 'outside development and test');
      require('PUBLIC_URL', 'outside development and test');
      require('BETTER_AUTH_SECRET', 'outside development and test');
    }
    // On a server a half-configured Google sign-in is a mistake; locally the secret may simply be absent.
    if (deployed(env.APP_ENV) && Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['GOOGLE_CLIENT_SECRET'], message: 'Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither' });
    }
    const transport = env.EMAIL_TRANSPORT ?? (deployed(env.APP_ENV) ? 'resend' : 'log');
    if (transport === 'resend') require('RESEND_API_KEY', 'to send email with Resend');
  })
  .transform((env) => {
    const isDev = env.APP_ENV === 'development';
    const publicUrl = (env.PUBLIC_URL ?? `http://localhost:${env.API_PORT}`).replace(/\/+$/, '');
    const corsOrigins = env.CORS_ORIGINS ?? (isDev ? ['http://localhost:8081'] : []);
    return {
      ...env,
      PUBLIC_URL: publicUrl,
      APP_URL: (env.APP_URL ?? (isDev ? 'http://localhost:8081' : publicUrl)).replace(/\/+$/, ''),
      CORS_ORIGINS: corsOrigins,
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? DEV_AUTH_SECRET,
      EMAIL_TRANSPORT: env.EMAIL_TRANSPORT ?? (deployed(env.APP_ENV) ? 'resend' : 'log'),
      PASSWORD_BREACH_CHECK: env.PASSWORD_BREACH_CHECK ?? env.APP_ENV !== 'test',
      RATE_LIMIT: env.RATE_LIMIT ?? deployed(env.APP_ENV),
    } as const;
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
