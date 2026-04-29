import { NextResponse } from 'next/server';
import { addAuditEntry, getAuditEntries } from '@/lib/data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  if (!patientId) return NextResponse.json({ entries: [] });

  const entries = await getAuditEntries(patientId);
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { patientId, clinician, reason, contextType } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    // Persist encrypted audit entry to MySQL
    await addAuditEntry({
      patient_id:   patientId,
      clinician:    clinician    || 'Unknown Clinician',
      reason:       reason       || 'Context Request',
      context_type: contextType  || 'specialist',
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Audit log error:', e);
    return NextResponse.json({ error: 'Failed to log audit entry' }, { status: 500 });
  }
}
