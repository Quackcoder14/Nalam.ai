import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({
    sub: session.sub,
    role: session.role,
    staffId: session.staffId,
    branch: session.branch ?? null,
    clinicianRole: session.clinicianRole ?? null,
  });
}
