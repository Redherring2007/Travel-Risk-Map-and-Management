import { NextResponse } from 'next/server';
import { getDemoSession, requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  const user = getDemoSession(request.headers);
  const admin = requireAdmin(user);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });
  const payload = await request.json();
  return NextResponse.json({ ok: true, data: payload, note: 'Admin override accepted in demo mode. Persist to admin_overrides in Neon for production.' });
}
