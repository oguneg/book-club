import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface Database {
  db: Db;
  /** Applies pending migrations from the `drizzle` folder (relative to the working directory). */
  migrate(): Promise<void>;
  /** True when the database answers within `timeoutMs`. */
  ping(timeoutMs?: number): Promise<boolean>;
  close(): Promise<void>;
}

const migrationsFolder = path.resolve('drizzle');

function pingWith(db: Db) {
  return async (timeoutMs = 2000) => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    const query = db.execute(sql`select 1`).then(
      () => true,
      () => false,
    );
    try {
      return await Promise.race([query, timeout]);
    } finally {
      clearTimeout(timer);
    }
  };
}

export function connectPostgres(url: string): Database {
  const client = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzlePostgres(client, { schema });
  return {
    db,
    migrate: () => migratePostgres(db, { migrationsFolder }),
    ping: pingWith(db),
    close: () => client.end({ timeout: 5 }),
  };
}

/**
 * Embedded Postgres (WASM) for local development and tests, so no Docker is needed.
 * Loaded lazily: it is a dev dependency and is not in the production image.
 * Without `dataDir` the database lives in memory.
 */
export async function connectPglite(dataDir?: string): Promise<Database> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  // PGlite does not create missing parent folders.
  if (dataDir) mkdirSync(path.resolve(dataDir), { recursive: true });
  const client = dataDir ? new PGlite(path.resolve(dataDir)) : new PGlite();
  const db = drizzle(client, { schema });
  return {
    db,
    migrate: () => migrate(db, { migrationsFolder }),
    ping: pingWith(db),
    close: () => client.close(),
  };
}
