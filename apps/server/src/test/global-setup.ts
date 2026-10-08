import { connectPostgres } from '../db/client';

// With a real Postgres (CI), every test file shares one database, so migrations run once here
// instead of concurrently from each file. Locally each file gets its own in-memory PGlite.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const database = connectPostgres(url);
  try {
    await database.migrate();
  } finally {
    await database.close();
  }
}
