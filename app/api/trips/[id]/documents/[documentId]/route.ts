import { NextResponse } from 'next/server';
import { getDemoSession, requirePaid } from '@/lib/auth';
import { store } from '@/lib/store';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const user = getDemoSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const { id, documentId } = await params;
  store.deleteDocument(id, documentId);
  return NextResponse.json({ ok: true });
}
