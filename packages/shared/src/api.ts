import { z } from 'zod';

export const healthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  /** Short git commit the server was built from. */
  version: z.string(),
  env: z.enum(['development', 'test', 'staging', 'production']),
  db: z.boolean(),
});
export type HealthResponse = z.infer<typeof healthResponse>;

/** What the app needs to know about the server before sign-in. */
export const publicConfig = z.object({
  google: z.boolean(),
});
export type PublicConfig = z.infer<typeof publicConfig>;
