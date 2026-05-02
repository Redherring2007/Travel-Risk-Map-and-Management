import { NextResponse } from 'next/server';
import { getSession, requireAdmin } from '@/lib/auth';
import { isNeonConfigured, query } from '@/lib/neon';

export async function POST(request: Request) {
  const user = getSession(request.headers);
  const admin = requireAdmin(user);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });
  const payload = await request.json();
  if (isNeonConfigured()) {
    await query('insert into users (id, email, role) values ($1, $2, $3) on conflict (id) do update set role = $3, updated_at = now()', [user.id, user.email, 'admin']);
    await query(
      `insert into admin_overrides (admin_user_id, target_type, target_id, field_name, new_value, reason)
       values ($1,$2,$3,$4,$5::jsonb,$6)`,
      [user.id, payload.targetType ?? 'risk_score', payload.targetId ?? payload.countryIso2 ?? 'unknown', payload.category ?? payload.fieldName ?? 'overall', JSON.stringify(payload), payload.reason ?? 'Manual risk override']
    );
  }
  return NextResponse.json({ ok: true, data: payload, mode: isNeonConfigured() ? 'neon-persisted' : 'demo-memory' });
}
