import { getSession, requireAdmin } from './auth';

export function requireIngestionAccess(request: Request) {
  const configuredSecret = process.env.ADMIN_INGEST_SECRET;
  const headerSecret = request.headers.get('x-admin-ingest-secret');
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerSecret = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

  if (configuredSecret && (headerSecret === configuredSecret || bearerSecret === configuredSecret)) {
    return { ok: true as const, mode: 'secret' as const };
  }

  const admin = requireAdmin(getSession(request.headers));
  if (admin.ok) return { ok: true as const, mode: 'demo-admin' as const };

  return { ok: false as const, status: 403, message: 'Admin ingestion access required.' };
}
