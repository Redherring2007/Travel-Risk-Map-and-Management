import { neon } from '@neondatabase/serverless';

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

export function isNeonConfigured() {
  return Boolean(getDatabaseUrl());
}

export async function query<T = unknown>(sqlText: string, params: unknown[] = []): Promise<T[]> {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('Neon is not configured. Set DATABASE_URL and run migrations before enabling persistent mode.');
  }
  const sql = neon(databaseUrl);
  return (await sql(sqlText, params)) as T[];
}
