import { NextResponse } from 'next/server';
import { getSession, requirePaid } from '@/lib/auth';
import { store } from '@/lib/store';

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const user = getSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const { id, documentId } = await params;
  const doc = await store.getDocument(id, documentId);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  return NextResponse.json({ data: doc, note: 'Use /api/storage/download-url for a short-lived signed S3 URL.' });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const user = getSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const { id, documentId } = await params;
  await store.deleteDocument(id, documentId);
  return NextResponse.json({ ok: true });
}
