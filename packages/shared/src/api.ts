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

/** A crash in the app, sent to the server (which forwards it to error tracking). Technical details only. */
export const clientErrorInput = z.object({
  type: z.string().trim().min(1).max(100),
  message: z.string().max(1000),
  stack: z.string().max(10_000).optional(),
  /** The page's path, without the query string. */
  page: z.string().max(300).regex(/^\/[^?#]*$/),
});
export type ClientErrorInput = z.infer<typeof clientErrorInput>;
