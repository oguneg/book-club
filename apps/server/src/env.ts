import { z } from 'zod';

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
  })
  .refine((env) => env.DATABASE_URL || env.APP_ENV === 'development' || env.APP_ENV === 'test', {
    message: 'DATABASE_URL is required outside development and test',
    path: ['DATABASE_URL'],
  })
  .transform((env) => ({
    ...env,
    CORS_ORIGINS: env.CORS_ORIGINS ?? (env.APP_ENV === 'development' ? ['http://localhost:8081'] : []),
  }));

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
