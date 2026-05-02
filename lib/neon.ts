export function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

export function isNeonConfigured() {
  return Boolean(getDatabaseUrl());
}

export async function query<T = unknown>(_sql: string, _params: unknown[] = []): Promise<T[]> {
  if (!isNeonConfigured()) {
    throw new Error('Neon is not configured. Set DATABASE_URL and run migrations before enabling persistent mode.');
  }

  // Production wiring options:
  // 1. Install @neondatabase/serverless and use neon(DATABASE_URL) for serverless/Vercel.
  // 2. Install pg and use Pool for long-running VPS Node processes.
  // This MVP keeps the interface explicit so persistence can be enabled without changing route contracts.
  throw new Error('Database driver not installed yet. Add @neondatabase/serverless or pg during production persistence hardening.');
}
