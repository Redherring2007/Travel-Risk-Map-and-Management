import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  return NextResponse.json({ data: getSession(request.headers), mode: 'auth-adapter; demo headers now, production auth provider can replace lib/auth.ts without changing route contracts.' });
}
