import { NextResponse } from 'next/server';
import { getDemoSession, requirePaid } from '@/lib/auth';
import { store } from '@/lib/store';

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const user = getDemoSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const { id, documentId } = await params;
  const doc = store.getDocument(id, documentId);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  return NextResponse.json({ data: doc, note: 'Production view should return a short-lived signed S3 URL.' });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const user = getDemoSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const { id, documentId } = await params;
  store.deleteDocument(id, documentId);
  return NextResponse.json({ ok: true });
}
