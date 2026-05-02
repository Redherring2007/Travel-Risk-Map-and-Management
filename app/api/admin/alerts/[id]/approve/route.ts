import { NextResponse } from 'next/server';
import { getSession, requireAdmin } from '@/lib/auth';
import { store } from '@/lib/store';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getSession(request.headers);
  const admin = requireAdmin(user);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });
  const { id } = await params;
  const alert = await store.approveAlert(id);
  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  return NextResponse.json({ data: alert });
}
